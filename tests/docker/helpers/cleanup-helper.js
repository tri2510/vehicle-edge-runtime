import { spawn } from 'child_process';

/**
 * Docker Test Cleanup Utility
 * Provides centralized cleanup functionality for Docker tests
 */
export class DockerCleanup {
    /**
     * Clean up all test containers with specific name pattern
     */
    static async cleanupTestContainers(pattern = 'vehicle-edge-test') {
        console.log(`🧹 Cleaning up containers matching pattern: ${pattern}`);

        try {
            // List all containers matching the pattern
            const ps = spawn('docker', ['ps', '-a', '--filter', `name=${pattern}`, '--format', '{{.Names}}'], {
                stdio: 'pipe'
            });

            let containerNames = '';
            ps.stdout.on('data', (data) => {
                containerNames += data.toString().trim();
            });

            await new Promise((resolve, reject) => {
                ps.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Failed to list containers: ${code}`));
                    }
                });
                ps.on('error', reject);
            });

            if (containerNames.trim()) {
                const containers = containerNames.split('\n').filter(name => name.trim());
                console.log(`Found ${containers.length} test containers to clean: ${containers.join(', ')}`);

                // Remove all matching containers
                for (const container of containers) {
                    await this.removeContainer(container);
                }
            } else {
                console.log('No test containers found to clean');
            }
        } catch (error) {
            console.log(`⚠️ Container cleanup failed: ${error.message}`);
        }
    }

    /**
     * Remove a single container
     */
    static async removeContainer(containerName) {
        return new Promise((resolve) => {
            console.log(`Removing container: ${containerName}`);

            const rm = spawn('docker', ['rm', '-f', containerName], {
                stdio: 'pipe',
                timeout: 5000
            });

            rm.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ Removed container: ${containerName}`);
                } else {
                    console.log(`⚠️ Failed to remove container: ${containerName} (code: ${code})`);
                }
                resolve();
            });

            rm.on('error', (error) => {
                console.log(`⚠️ Error removing container ${containerName}: ${error.message}`);
                resolve();
            });

            rm.on('timeout', () => {
                console.log(`⏰ Timeout removing container: ${containerName}`);
                rm.kill();
                resolve();
            });
        });
    }

    /**
     * Clean up test images
     */
    static async cleanupTestImages() {
        console.log('🧹 Cleaning up test images...');

        const testImages = [
            'vehicle-edge-runtime:test',
            'vehicle-edge-runtime:test-build'
        ];

        for (const image of testImages) {
            await this.removeImage(image);
        }
    }

    /**
     * Remove a single image
     */
    static async removeImage(imageName) {
        return new Promise((resolve) => {
            const rmi = spawn('docker', ['rmi', '-f', imageName], {
                stdio: 'pipe',
                timeout: 10000
            });

            rmi.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ Removed image: ${imageName}`);
                } else {
                    console.log(`⚠️ Failed to remove image: ${imageName} (code: ${code})`);
                }
                resolve();
            });

            rmi.on('error', (error) => {
                console.log(`⚠️ Error removing image ${imageName}: ${error.message}`);
                resolve();
            });

            rmi.on('timeout', () => {
                console.log(`⏰ Timeout removing image: ${imageName}`);
                rmi.kill();
                resolve();
            });
        });
    }

    /**
     * Clean up orphaned Docker networks
     */
    static async cleanupNetworks() {
        console.log('🧹 Cleaning up orphaned Docker networks...');

        try {
            const networkPrune = spawn('docker', ['network', 'prune', '-f'], {
                stdio: 'pipe',
                timeout: 5000
            });

            await new Promise((resolve) => {
                networkPrune.on('close', () => resolve());
                networkPrune.on('error', () => resolve());
                networkPrune.on('timeout', () => {
                    networkPrune.kill();
                    resolve();
                });
            });

            console.log('✅ Network cleanup completed');
        } catch (error) {
            console.log(`⚠️ Network cleanup failed: ${error.message}`);
        }
    }

    /**
     * Full cleanup routine for Docker tests
     */
    static async fullCleanup(patterns = ['vehicle-edge-test']) {
        console.log('🚀 Starting full Docker cleanup...');

        for (const pattern of patterns) {
            await this.cleanupTestContainers(pattern);
        }

        await this.cleanupTestImages();
        await this.cleanupNetworks();

        console.log('✅ Full Docker cleanup completed');
    }
}