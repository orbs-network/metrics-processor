#!/bin/sh -xe

git pull
npm run build
pm2 reload pm2/ecosystem.config.js --update-env
pm2 save