# Gâche électrique

## Pré-requis

### Installer Node.js

```sh
wget https://unofficial-builds.nodejs.org/download/release/v20.12.0/node-v20.12.0-linux-armv6l.tar.gz \
  && tar -xzf node-v20.12.0-linux-armv6l.tar.gz \
  && cd node-v20.12.0-linux-armv6l
  && sudo cp -R * /usr/local
  && rm -rf node-v20.12.0-linux-armv6l*
```

### Installer le projet

```sh
git clone [chemin_du_projet] /home/pi/raspberry-electric-lock \
  && cd /home/pi/raspberry-electric-lock \
  && npm ci
```

### Configurer le Raspberry pour lancer le script au démarrage

- Créer un fichier `/lib/systemd/system/raspberry-electric-lock.service`
- Copier le contenu :

```
[Unit]
Description=Gâche électrique
After=multi-user.target

[Service]
Type=idle
ExecStart=node /home/pi/raspberry-electric-lock.service

[Install]
WantedBy=multi-user.target
```

- Modifier les permissions du fichier

```sh
sudo chmod 644 /lib/systemd/system/raspberry-electric-lock.service
```

- Indiquer à systemd que le script doit être lancé au démarrage

```sh
sudo systemctl enable raspberry-electric-lock.service
```
