# ReList Documentation

Complete documentation for deploying and maintaining ReList.

## 📚 Essential Documentation

### Deployment
- **[QUICKSTART-EC2.md](./QUICKSTART-EC2.md)** - Deploy to AWS EC2 in under 10 minutes
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide with troubleshooting
- **[deploy-ec2.sh](./deploy-ec2.sh)** - Automated deployment script

### Getting Started
Start with the [QUICKSTART-EC2.md](./QUICKSTART-EC2.md) guide for the fastest path to deployment.

## 📁 Additional Documentation

Additional reference materials are available in the [extra/](./extra/) directory:
- Architecture documents
- Implementation checklists
- Database schema export tools
- Docker configuration guides
- API scraper documentation

## 🚀 Quick Deploy

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ec2-user@YOUR_EC2_IP

# Run automated deployment
curl -fsSL https://raw.githubusercontent.com/alexwebb-biz/relist/main/docs/deploy-ec2.sh -o deploy-ec2.sh
chmod +x deploy-ec2.sh
./deploy-ec2.sh
```

## 📖 Documentation Index

### Deployment
1. [Quick Start](./QUICKSTART-EC2.md) - 10-minute setup
2. [Full Deployment Guide](./DEPLOYMENT.md) - Detailed instructions
3. [Deployment Script](./deploy-ec2.sh) - Automation script

### Reference (extra/)
- [Technical Architecture](./extra/technical_architecture.md)
- [Implementation Checklist](./extra/implementation_checklist.md)
- [Docker Guide](./extra/DOCKER.md)
- [Scraper Documentation](./extra/scraper_docs.md)
- [Schema Export Tools](./extra/) - Database migration utilities

## 🔗 Quick Links

- **Main README**: [../README.md](../README.md)
- **Environment Config**: [../.env.example](../.env.example)
- **Docker Compose**: [../docker-compose.yml](../docker-compose.yml)
- **Production Compose**: [../docker-compose.prod.yml](../docker-compose.prod.yml)

## 💡 Need Help?

- Check [DEPLOYMENT.md](./DEPLOYMENT.md) troubleshooting section
- Open an issue on GitHub
- Email: support@relist.app
