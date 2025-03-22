# this image relies on the nodejs image
FROM node:20-alpine
# set working directory
WORKDIR /usr/src/network


# let NPM packages be called anywhere within the container
ENV PATH /usr/src/network/node_modules/.bin:${PATH}
ADD package.json .
RUN npm install


# source files of the authentication service
ADD gulpfile.js .
ADD src src

# header for loggining messages
ENV DEBUG product-d

# we now use an script to deploy the authentication service
CMD npm start