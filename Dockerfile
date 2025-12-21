FROM oven/bun:1-alpine

WORKDIR /usr/src/app

COPY package.json bun.lockb* ./
RUN bun install --production

COPY . .

EXPOSE 13470

ENV NODE_ENV=production

CMD ["bun", "run", "src/index.ts"]
