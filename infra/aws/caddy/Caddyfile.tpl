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

	# Disable Caddy's automatic HTTP→HTTPS redirect listener on :80.
	# We define our own explicit `:80` catch-all below so that *any* Host
	# header (the canonical domain, the bare EIP, scanner probes with a
	# bogus Host, …) is handled by the same redirect block — instead of
	# Caddy's auto-redirect only firing for {$ATMEMLY_DOMAIN} and unknown
	# hosts falling through to a 200 against the upstream marketplace SPA
	# (task #40).
	#
	# `disable_redirects` only turns off the auto HTTP→HTTPS redirect; it
	# does NOT disable the ACME HTTP-01 challenge solver. Caddy's TLS app
	# still intercepts /.well-known/acme-challenge/* on :80 before our
	# site's handlers run, so Let's Encrypt renewals continue to succeed.
	auto_https disable_redirects
}

{$ATMEMLY_DOMAIN} {
	encode gzip zstd

	# Forward everything to the in-cluster nginx container, which fans
	# out to /api (api-server), /admin (admin SPA) and / (marketplace SPA).
	reverse_proxy http://nginx:80 {
		header_up Host {host}
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-For {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}

	# Caddy issues + auto-renews a Let's Encrypt cert for $ATMEMLY_DOMAIN
	# over the ACME HTTP-01 challenge on :80 (handled by Caddy's TLS app
	# before the :80 redirect block below ever sees the request).
}

# Catch-all on :80 — redirect every plain-HTTP request to the canonical
# HTTPS URL, regardless of Host header. This covers:
#   * http://app.atmemli.com/...   → 308 https://app.atmemli.com/... (preserved)
#   * http://63.34.129.118/...     → 308 https://app.atmemli.com/... (was 200 marketplace SPA)
#   * any other Host (scanners, stale CNAMEs, raw IP probes) → same 308
#
# Path is preserved via {uri}. We never reverse-proxy to nginx from this
# block, so the marketplace SPA can no longer be served in clear text on
# the bare EIP. ACME HTTP-01 challenges are intercepted by Caddy's TLS
# app earlier in the request pipeline, so cert renewals are unaffected.
:80 {
	redir https://{$ATMEMLY_DOMAIN}{uri} 308
}
