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

## Config

1. Download redis.conf to /etc/redis/
2. Download zip file with json module to same folder
3. Unzip
4. Restart
