# this image relies on the nodejs image
FROM node:24-alpine
# set working directory
WORKDIR /usr/src/network


# let NPM packages be called anywhere within the container
ENV PATH /usr/src/network/node_modules/.bin:${PATH}
ADD package.json .
ADD templates templates
ADD orthancManager.sh .
RUN npm install


# source files of the authentication service
ADD gulpfile.js .
ADD src src

# Install Docker CLI
RUN apk add --no-cache docker-cli

# Install bash
RUN apk update && apk add bash && apk add curl && apk add jq 

# header for loggining messages
ENV DEBUG network-d

# we now use an script to deploy the network service
CMD npm start