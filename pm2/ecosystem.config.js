module.exports = {
    apps: [{
        name: 'prom-client-1000000-3022',
        script: 'dist/prometheus-client.js',
        // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
        interpreter: '/home/ec2-user/.nvm/versions/node/v11.13.0/bin/node',
        args: '1000000 3022',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'development'
        },
        env_production: {
            NODE_ENV: 'production'
        }
    },
        {
            name: 'prom-client-1000001-3021',
            script: 'dist/prometheus-client.js',
            // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
            interpreter: '/home/ec2-user/.nvm/versions/node/v11.13.0/bin/node',
            args: '1000001 3021',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'development'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        },
        {
            name: 'prom-client-1100000-3020',
            script: 'dist/prometheus-client.js',
            // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
            interpreter: '/home/ec2-user/.nvm/versions/node/v11.13.0/bin/node',
            args: '1100000 3020',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'development'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        }
    ],

    deploy: {
        production: {
            user: 'node',
            host: '212.83.163.1',
            ref: 'origin/master',
            repo: 'git@github.com:repo.git',
            path: '/var/www/production',
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
        }
    }
};