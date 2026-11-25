FROM ghcr.io/sdr-enthusiasts/docker-baseimage:base

LABEL org.opencontainers.image.source="https://github.com/TheFilipcom4607/plane-alert-db-web"

# The base image already has nginx-light, curl and s6-overlay.
RUN rm -rf /var/www/html/*

COPY rootfs/ /
COPY web/ /var/www/html/

# Show which commit of this repo the page was built from (set by the GitHub workflow)
ARG COMMIT=dev
RUN sed -i "s/__COMMIT__/$(echo "$COMMIT" | cut -c1-7)/g" /var/www/html/index.html

EXPOSE 80
