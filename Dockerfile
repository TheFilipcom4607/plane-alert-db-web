FROM ghcr.io/sdr-enthusiasts/docker-baseimage:base

LABEL org.opencontainers.image.source="https://github.com/TheFilipcom4607/plane-alert-db-web"

# The base image already has nginx-light, curl and s6-overlay.
RUN rm -rf /var/www/html/*

COPY rootfs/ /
COPY web/ /var/www/html/

EXPOSE 80
