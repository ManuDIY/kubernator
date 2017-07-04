# Builder

FROM node:6 as builder

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json yarn.lock ./
RUN yarn install

COPY . .
RUN yarn build


# Runner

FROM nginx
COPY --from=builder /usr/src/app/build /usr/share/nginx/html

COPY build /usr/share/nginx/html
