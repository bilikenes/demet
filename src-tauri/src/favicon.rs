//! Web adreslerinin site simgesini (favicon) siteden doğrudan alır ve diskte önbellekler.
//! Üçüncü taraf bir simge servisi kullanılmaz: istek yalnızca öğedeki sitenin kendisine gider.

use base64::{engine::general_purpose::STANDARD, Engine};
use std::{
    fs,
    path::PathBuf,
    time::{Duration, SystemTime},
};
use url::Url;

const MAX_HTML_BYTES: u64 = 512 * 1024;
const MAX_ICON_BYTES: u64 = 256 * 1024;
const FOUND_TTL: Duration = Duration::from_secs(7 * 24 * 3600);
const MISSING_TTL: Duration = Duration::from_secs(24 * 3600);

fn cache_dir() -> PathBuf {
    std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Demet")
        .join("favicons")
}

fn cache_file(host: &str) -> PathBuf {
    let safe: String = host
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '.' || c == '-' { c } else { '_' })
        .collect();
    cache_dir().join(format!("{safe}.txt"))
}

fn read_cache(path: &PathBuf) -> Option<Option<String>> {
    let age = fs::metadata(path)
        .ok()?
        .modified()
        .ok()
        .and_then(|m| SystemTime::now().duration_since(m).ok())?;
    let text = fs::read_to_string(path).ok()?;
    if text.is_empty() {
        (age < MISSING_TTL).then_some(None)
    } else {
        (age < FOUND_TTL).then_some(Some(text))
    }
}

fn write_cache(path: &PathBuf, value: Option<&str>) {
    let _ = fs::create_dir_all(cache_dir());
    let _ = fs::write(path, value.unwrap_or(""));
}

fn agent() -> ureq::Agent {
    let config = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(5)))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Demet/0.1")
        .build();
    ureq::Agent::new_with_config(config)
}

/// Sitenin simgesini data URL olarak döndürür; bulunamazsa `None`.
pub fn fetch(raw_url: &str) -> Option<String> {
    let trimmed = raw_url.trim();
    let with_scheme = if trimmed.to_ascii_lowercase().starts_with("http://")
        || trimmed.to_ascii_lowercase().starts_with("https://")
    {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };
    let page = Url::parse(&with_scheme).ok()?;
    let host = page.host_str()?.to_string();

    let cache = cache_file(&host);
    if let Some(hit) = read_cache(&cache) {
        return hit;
    }

    let result = fetch_uncached(&page);
    write_cache(&cache, result.as_deref());
    result
}

fn fetch_uncached(page: &Url) -> Option<String> {
    let agent = agent();
    let mut candidates: Vec<String> = Vec::new();

    if let Ok(mut response) = agent.get(page.as_str()).call() {
        if let Ok(html) = response
            .body_mut()
            .with_config()
            .limit(MAX_HTML_BYTES)
            .lossy_utf8(true)
            .read_to_string()
        {
            for href in icon_links(&html) {
                if href.to_ascii_lowercase().starts_with("data:image") {
                    return Some(href);
                }
                if let Ok(resolved) = page.join(&href) {
                    candidates.push(resolved.to_string());
                }
            }
        }
    }
    if let Ok(root_icon) = page.join("/favicon.ico") {
        candidates.push(root_icon.to_string());
    }

    candidates.dedup();
    candidates.into_iter().find_map(|url| download_icon(&agent, &url))
}

fn download_icon(agent: &ureq::Agent, url: &str) -> Option<String> {
    let mut response = agent.get(url).call().ok()?;
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    let bytes = response
        .body_mut()
        .with_config()
        .limit(MAX_ICON_BYTES)
        .read_to_vec()
        .ok()?;
    if bytes.len() < 16 {
        return None;
    }
    let mime = sniff_mime(&bytes).or_else(|| {
        content_type
            .starts_with("image/")
            .then_some(content_type.as_str())
    })?;
    Some(format!("data:{mime};base64,{}", STANDARD.encode(&bytes)))
}

/// Gövdenin gerçekten bir görsel olduğunu doğrular (HTML hata sayfalarını eler).
fn sniff_mime(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
        Some("image/png")
    } else if bytes.starts_with(&[0, 0, 1, 0]) {
        Some("image/x-icon")
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if bytes.starts_with(b"GIF8") {
        Some("image/gif")
    } else if bytes.len() > 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        let head = String::from_utf8_lossy(&bytes[..bytes.len().min(512)]).to_ascii_lowercase();
        (head.contains("<svg")).then_some("image/svg+xml")
    }
}

/// `<link rel="icon" ...>` etiketlerinden adresleri döndürür; `icon` olanlar `apple-touch-icon`'dan önce gelir.
fn icon_links(html: &str) -> Vec<String> {
    let lower = html.to_ascii_lowercase();
    let mut primary = Vec::new();
    let mut apple = Vec::new();
    let mut from = 0;

    while let Some(offset) = lower[from..].find("<link") {
        let start = from + offset;
        let end = lower[start..].find('>').map(|e| start + e).unwrap_or(lower.len());
        let tag = &html[start..end];
        let tag_lower = &lower[start..end];
        from = end.max(start + 5);

        let (Some(rel), Some(href)) = (attr(tag, tag_lower, "rel"), attr(tag, tag_lower, "href")) else {
            continue;
        };
        let rel = rel.to_ascii_lowercase();
        let tokens: Vec<&str> = rel.split_whitespace().collect();
        if tokens.contains(&"apple-touch-icon") {
            apple.push(href);
        } else if tokens.contains(&"icon") {
            primary.push(href);
        }
    }

    primary.extend(apple);
    primary
}

fn attr(tag: &str, tag_lower: &str, name: &str) -> Option<String> {
    let needle = format!("{name}=");
    let mut search = 0;
    while let Some(pos) = tag_lower[search..].find(&needle) {
        let at = search + pos;
        let boundary = at == 0 || tag_lower.as_bytes()[at - 1].is_ascii_whitespace();
        search = at + needle.len();
        if !boundary {
            continue;
        }
        let rest = &tag[search..];
        return Some(match rest.chars().next()? {
            q @ ('"' | '\'') => rest[1..].split(q).next()?.to_string(),
            _ => rest
                .split(|c: char| c.is_whitespace() || c == '>' || c == '/')
                .next()?
                .to_string(),
        });
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_icon_links_in_priority_order() {
        let html = r#"<head><link rel="apple-touch-icon" href="/a.png">
            <LINK REL="shortcut icon" HREF='/f.ico'><link rel="stylesheet" href="/x.css"></head>"#;
        assert_eq!(icon_links(html), vec!["/f.ico", "/a.png"]);
    }

    /// Gerçek ağ gerektirir: `cargo test --lib -- --ignored`
    #[test]
    #[ignore]
    fn fetches_real_favicons() {
        for site in ["https://github.com", "wikipedia.org", "https://www.python.org"] {
            let icon = fetch(site).unwrap_or_else(|| panic!("{site} için simge alınamadı"));
            assert!(icon.starts_with("data:image/"), "{site}: {}", &icon[..40.min(icon.len())]);
            println!("{site}: {} bayt, {}", icon.len(), &icon[..30]);
        }
    }

    #[test]
    fn sniffs_images_and_rejects_html() {
        assert_eq!(sniff_mime(&[0x89, b'P', b'N', b'G', 1, 2, 3]), Some("image/png"));
        assert_eq!(sniff_mime(&[0, 0, 1, 0, 1, 0]), Some("image/x-icon"));
        assert_eq!(sniff_mime(b"<!doctype html><html>"), None);
    }
}
