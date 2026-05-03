{
    email {$ATMEMLY_ACME_EMAIL}
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
