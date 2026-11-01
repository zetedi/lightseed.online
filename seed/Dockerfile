FROM node:22-alpine AS domain-build
WORKDIR /app/seed
COPY seed/package.json seed/package-lock.json ./
RUN npm ci --include=dev --ignore-scripts && npm cache clean --force
COPY seed/build-domain.mjs ./
COPY src/domain /app/src/domain
RUN npm run build:domain

FROM node:22-alpine
WORKDIR /app/seed
COPY seed/package.json seed/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=domain-build /app/seed/generated ./generated
COPY seed/api ./api
COPY src/domain/seedBeing.mjs /app/src/domain/
COPY src/domain/seedEvent.mjs /app/src/domain/
COPY src/domain/seedAlignment.mjs /app/src/domain/
COPY src/domain/seedOffering.mjs /app/src/domain/
COPY src/domain/seedPulse.mjs /app/src/domain/
COPY src/domain/seedBlock.mjs /app/src/domain/
COPY src/domain/seedLink.mjs /app/src/domain/
COPY src/domain/seedSigning.mjs /app/src/domain/
COPY src/domain/seedVision.mjs /app/src/domain/
COPY src/domain/seedMedia.mjs src/domain/seedTransaction.mjs src/domain/seedTreeInvite.mjs src/domain/seedRequest.mjs src/domain/seedDocs.mjs src/domain/seedOrgans.mjs src/domain/seedAuth.mjs src/domain/seedTree.mjs src/domain/seedInvite.mjs src/domain/seedCommunity.mjs src/domain/seedProfile.mjs src/domain/personName.mjs src/domain/uuidv7.mjs /app/src/domain/
RUN mkdir -p /app/media && chown node:node /app/media
USER node
EXPOSE 8081
CMD ["node", "api/main.mjs"]
