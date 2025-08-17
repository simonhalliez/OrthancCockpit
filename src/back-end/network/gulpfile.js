const gulp = require('gulp')
const nodemon = require('gulp-nodemon')
const { exec } = require('child_process');

gulp.task('start', () => {
  nodemon({
    script: './src/daemon',
    ignore: ['./templates/**'],
  })
})

gulp.task('default', gulp.series('start'))
