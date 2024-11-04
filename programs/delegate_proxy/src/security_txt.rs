#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    // Required fields
    name: "goDefi",
    project_url: "https://godefi.me",
    contacts: "email:corp@godefi.me",
    policy: "https://godefi.me/disclosure-policy.html",

    // Optional Fields
    preferred_languages: "en"
}
