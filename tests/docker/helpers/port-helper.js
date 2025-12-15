import { spawn } from 'child_process';

/**
 * Kill processes using specified ports
 * @param {number[]} ports - Array of port numbers to kill
 */
export async function killPorts(ports) {
    console.log(`🔧 Killing processes on ports: ${ports.join(', ')}`);

    for (const port of ports) {
        try {
            // Kill processes using the port
            await new Promise((resolve, reject) => {
                const fuser = spawn('fuser', ['-k', '-n', 'tcp', port.toString()], {
                    stdio: 'pipe'
                });

                fuser.on('close', (code) => {
                    // fuser returns 0 if processes were killed, 1 if no processes were using the port
                    resolve();
                });

                fuser.on('error', (error) => {
                    // fuser not available, try lsof
                    try {
                        const lsof = spawn('lsof', ['-ti', `:${port}`], {
                            stdio: 'pipe'
                        });

                        let pids = '';
                        lsof.stdout.on('data', (data) => {
                            pids += data.toString().trim();
                        });

                        lsof.on('close', (code) => {
                            if (code === 0 && pids) {
                                const kill = spawn('kill', ['-9', ...pids.split('\n')]);
                                kill.on('close', () => resolve());
                                kill.on('error', () => resolve());
                            } else {
                                resolve();
                            }
                        });

                        lsof.on('error', () => resolve());
                    } catch (e) {
                        resolve();
                    }
                });
            });

            // Wait a moment for processes to fully terminate
            await new Promise(resolve => setTimeout(resolve, 1000));

            console.log(`✅ Port ${port} cleared`);
        } catch (error) {
            console.log(`⚠️ Could not clear port ${port}: ${error.message}`);
        }
    }
}

/**
 * Kill processes using default Docker test ports (3002, 3003)
 */
export async function killDefaultDockerPorts() {
    await killPorts([3002, 3003]);
}