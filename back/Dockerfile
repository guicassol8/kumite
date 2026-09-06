# Build context is the repo root (docker build -f back/Dockerfile .): the
# pnpm workspace (back depends on @kumite/blocks) needs the root lockfile and
# both packages' package.json to install correctly.
#
# Full `bookworm` (not `-slim`), Node 22 (not 20): argon2@0.45.1's prebuilt
# native addon reliably segfaults on Node 20 in a bare container — confirmed
# via `process.dlopen` directly on the shipped .node file, same binary loads
# fine under Node 22. `back/package.json` only requires node >=20, so pinning
# the image to 22 stays within that contract.

FROM node:22-bookworm AS deps
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY back/package.json back/package.json
COPY blocks/package.json blocks/package.json
# Full deps, not --prod: tsx is a devDependency and `pnpm start` needs it,
# same as the tested dev/CI path (package.json's `start` script).
# --ignore-scripts: the root "prepare" script runs `lefthook install`, which
# needs a real .git dir this build context doesn't have. argon2's own install
# script (loads its bundled prebuild here) is restored explicitly right after.
RUN pnpm install --frozen-lockfile --ignore-scripts \
    && pnpm rebuild argon2

FROM node:22-bookworm AS runtime
WORKDIR /app
RUN corepack enable
# package.json pins "packageManager": pnpm@10.32.1 — corepack needs it in
# every directory it's invoked from, or it silently grabs pnpm@latest instead.
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/back/node_modules /app/back/node_modules
COPY --from=deps /app/blocks/node_modules /app/blocks/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY back back
COPY blocks blocks
WORKDIR /app/back
EXPOSE 3000
CMD ["pnpm", "start"]
