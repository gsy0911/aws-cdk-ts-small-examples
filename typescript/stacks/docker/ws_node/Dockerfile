FROM node:14.1.0-alpine

WORKDIR /usr/src/app

ADD ./express/app.js .
ADD ./express/index.html .
ADD ./express/package.json .

RUN npm install

EXPOSE 8080

CMD node app.js
