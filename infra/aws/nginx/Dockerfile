FROM nginx:1.27-alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY atmemly.conf /etc/nginx/conf.d/atmemly.conf

# Static assets are mounted at runtime under /srv/marketplace and /srv/admin
# (populated by the deploy script from the marketplace + admin builder images).
RUN mkdir -p /srv/marketplace /srv/admin

EXPOSE 80
