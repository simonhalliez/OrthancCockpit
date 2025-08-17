const { spawn } = require('child_process');
const log = require('debug')('network-d');

/**
 * Utility service for executing commands and listening to process output line by line.
 */
class DockerService {
    /**
     * Executes a command and returns the complete output.
     * @param {string} command - The command to execute (e.g., 'docker').
     * @param {string[]} args - Arguments for the command.
     * @returns {Promise<string>} Resolves with stdout output, rejects with stderr on error.
     */
    static runCommand(command, args) {
        return new Promise((resolve, reject) => {
            const dockerProcess = spawn(command, args);
            let output = '';
            let stderr = '';
            dockerProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
        
            dockerProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            dockerProcess.on('error', (error) => {
                log(`Error in docker command: ${error}`);
            });
    
            dockerProcess.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error(stderr));
                }
            });
        });
    }

    /**
     * Starts a process and calls a callback for each new output line.
     * @param {string} name - Name of the process for logging.
     * @param {string} command - Command to execute.
     * @param {string[]} args - Arguments for the command.
     * @param {function(string):void} onNewLine - Callback called for each new line.
     * @param {function(Error):void} onError - Callback called on error.
     */
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