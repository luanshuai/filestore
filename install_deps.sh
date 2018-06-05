#!/bin/sh
#echo "deb http://ftp.debian.org/debian jessie-backports main" > /etc/apt/sources.list.d/backports.list

apt-get update

apt-get install vim imagemagick optipng --yes
#apt-get -t jessie-backports --no-install-recommends -y install firejail

wget -q https://sourceforge.net/projects/firejail/files/firejail/firejail_0.9.52_1_amd64.deb/download -O firejail_0.9.52_1_amd64.deb

dpkg -i firejail_0.9.52_1_amd64.deb

wget -q https://s3.amazonaws.com/sl-public-dev-assets/ghostscript-9.15.tar.gz -O /tmp/ghostscript-9.15.tar.gz
cd /tmp
tar -xvf /tmp/ghostscript-9.15.tar.gz
cd /tmp/ghostscript-9.15 && ./configure && make && make install
npm rebuild
mkdir /app/user_files/ /app/uploads/ /app/template_files/
chown -R node:node /app/user_files
chown -R node:node /app/uploads
chown -R node:node /app/template_files
ls -al /app
