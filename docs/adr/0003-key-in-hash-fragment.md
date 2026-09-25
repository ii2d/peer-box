# Key in Hash Fragment

When sharing password-protected rooms via URL links, the Room Key must be encoded exclusively in the URL hash fragment (`#key=...`). Browsers never transmit URL hash fragments in HTTP request headers, ensuring that GitHub Pages, hosting providers, CDNs, and intermediary proxies have zero knowledge of the room key.
