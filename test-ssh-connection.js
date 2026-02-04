const { Client: SSHClient } = require('ssh2');
const { Client: PgClient } = require('pg');

const sshConfig = {
  host: 'itts028c.itts.ttu.edu',
  port: 22,
  username: 'simarsin',
  password: 'TexasTech2024!',
  readyTimeout: 30000,
};

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'ttuo',
  user: 'webuser',
  password: 'AnthonyKasey2024!',
};

console.log('🔧 Testing SSH + PostgreSQL Connection...\n');

const sshClient = new SSHClient();
let connectionTimeout;

connectionTimeout = setTimeout(() => {
  console.log('❌ TIMEOUT: Connection took longer than 30 seconds');
  sshClient.end();
  process.exit(1);
}, 30000);

sshClient.on('ready', () => {
  console.log('✅ SSH connection established');
  
  sshClient.forwardOut(
    '127.0.0.1',
    0,
    dbConfig.host,
    dbConfig.port,
    async (err, stream) => {
      if (err) {
        clearTimeout(connectionTimeout);
        console.error('❌ SSH port forwarding failed:', err.message);
        sshClient.end();
        process.exit(1);
        return;
      }

      console.log('✅ SSH tunnel created');
      console.log('🔌 Setting up local forwarding...');
      
      // Pipe the stream properly
      const net = require('net');
      const server = net.createServer((sock) => {
        sshClient.forwardOut(
          sock.remoteAddress,
          sock.remotePort,
          dbConfig.host,
          dbConfig.port,
          (err, stream) => {
            if (err) {
              sock.end();
              return;
            }
            sock.pipe(stream).pipe(sock);
          }
        );
      }).listen(0, 'localhost', async () => {
        const localPort = server.address().port;
        console.log(`✅ Local tunnel on localhost:${localPort}`);
        console.log('🔌 Connecting to PostgreSQL...');

        const pgClient = new PgClient({
          host: 'localhost',
          port: localPort,
          database: dbConfig.database,
          user: dbConfig.user,
          password: dbConfig.password,
        });

      try {
        await pgClient.connect();
        console.log('✅ PostgreSQL connected');
        
        const result = await pgClient.query('SELECT version()');
        console.log('✅ Query successful:', result.rows[0].version);
        
        await pgClient.end();
        clearTimeout(connectionTimeout);
        server.close();
        sshClient.end();
        
        console.log('\n🎉 SUCCESS! All connections working.');
        console.log('\nYour configuration is correct.');
        process.exit(0);
      } catch (error) {
        clearTimeout(connectionTimeout);
        console.error('❌ PostgreSQL connection failed:', error.message);
        await pgClient.end().catch(() => {});
        server.close();
        sshClient.end();
        process.exit(1);
      }
    });
    }
  );
});

sshClient.on('error', (err) => {
  clearTimeout(connectionTimeout);
  console.error('❌ SSH connection failed:', err.message);
  process.exit(1);
});

sshClient.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
  console.log('⚠️  Keyboard-interactive auth required');
  console.log('Prompts:', prompts);
  finish([sshConfig.password]);
});

console.log(`📡 Attempting SSH connection to ${sshConfig.host}:${sshConfig.port} as ${sshConfig.username}...`);
sshClient.connect(sshConfig);
