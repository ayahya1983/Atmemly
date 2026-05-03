{
    email {$ATMEMLY_ACME_EMAIL}

    # Disable HTTP/3. Our EC2 security group only opens TCP 80/443 — UDP 443
    # (required for QUIC) is closed end-to-end, so advertising HTTP/3 via
    # Alt-Svc only causes Chrome to try QUIC, fail, and surface
    # ERR_QUIC_PROTOCOL_ERROR (which is exactly what took the site down on
    # 2026-05-03). Pin Caddy to HTTP/1.1 + HTTP/2 over TCP only.
    servers {
        protocols h1 h2
    }
}

{$ATMEMLY_DOMAIN} {
    encode gzip zstd

    # Forward everything to the in-cluster nginx container, which fans
    # out to /api (api-server), /admin (admin SPA) and / (marketplace SPA).
    reverse_proxy http://nginx:80 {
        header_up Host              {host}
        header_up X-Real-IP         {remote_host}
        header_up X-Forwarded-For   {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # Caddy issues + auto-renews a Let's Encrypt cert for $ATMEMLY_DOMAIN.
    # Plain HTTP requests on port 80 are redirected to HTTPS automatically
    # by Caddy's default behaviour, so no separate redirect block is needed.
}
