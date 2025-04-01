const gulp = require('gulp')
const nodemon = require('gulp-nodemon')
const { exec } = require('child_process');

gulp.task('start', () => {
  nodemon({
    script: './src/daemon',
    ignore: ['./templates/**'],
  })
})

// gulp.task('start', (cb) => {
//   exec('node ./src/daemon', (err, stdout, stderr) => {
//     if (err) {
//       console.error(`Error: ${err.message}`);
//       return cb(err);
//     }
//     console.log(stdout);
//     console.error(stderr);
//     cb();
//   });
// });


gulp.task('default', gulp.series('start'))
