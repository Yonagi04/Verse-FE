ARG RUNTIME_IMAGE
FROM ${RUNTIME_IMAGE}
ENV BACKEND_UPSTREAM=http://backend:8080
COPY dist/ /usr/share/nginx/html/
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 8080
