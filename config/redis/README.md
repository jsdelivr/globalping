### Redis prod setup

```
echo never > /sys/kernel/mm/transparent_hugepage/enabled
echo 'vm.overcommit_memory = 1' >> /etc/sysctl.conf
echo 'vm.swappiness = 1' >> /etc/sysctl.conf

fallocate -l 90G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Docker config

Assuming you start in this directory:

```
cp .env.redis ../../
```

Set the redis password and return to the project root. Then:

```
docker compose up -d
```
