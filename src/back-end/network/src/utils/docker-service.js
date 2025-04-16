const { spawn } = require('child_process');
const { on } = require('events');
const log = require('debug')('network-d');

class DockerService {
    static runCommand(command, args) {
        return new Promise((resolve, reject) => {
            const dockerProcess = spawn(command, args);
            let output = '';
        
            dockerProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
        
            dockerProcess.stderr.on('data', (data) => {
                log(`Error in the output of the command: ${data.toString()}`);
            });

            dockerProcess.on('error', (error) => {
                log(`Error in docker command: ${error}`);
            });
    
            dockerProcess.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error(`Docker command failed with code ${code}`));
                }
            });
        });
    }

    static async lineProcessListener(name, command, args, onNewLine, onError) {
        log(`Listening to ${name} events...`);
        const dockerProcess = spawn(command, args);
        let outputBuffer = '';
        dockerProcess.stdout.on('data', async (outputChunk) => {
            outputBuffer += outputChunk.toString();
      
            const lines = outputBuffer.split('\n');
        
            for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i].trim();
                if (line) {
                    try {
                        onNewLine(line);
                    } catch (err) {
                        onError(err);
                    }
                }
            }
        
            // Keep the last (potentially incomplete) line in the buffer
            outputBuffer = lines[lines.length - 1];
        });
        dockerProcess.stderr.on('data', (data) => {
            log(`Error in the output of ${name} listrner: ${data.toString()}`);
        });
        dockerProcess.on('error', (error) => {
            log(`Error in the line process listener ${name}: ${error}`);
        });
        dockerProcess.on('close', (code) => {
            log(`Line events listener for ${name} exited with code ${code}`);
            bufferedDockerListener(command, args, onNewLine, onError);
        });
    }
}

module.exports = { DockerService };