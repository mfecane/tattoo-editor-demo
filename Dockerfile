FROM node:22-bookworm-slim

# git: local version control (status, diff, commit, log)
# curl/ca-certificates: general fetch/TLS support
# less/procps/jq: used by many CLI tools and scripts (paging, ps, JSON parsing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    less \
    procps \
    jq \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

CMD ["tail", "-f", "/dev/null"]
