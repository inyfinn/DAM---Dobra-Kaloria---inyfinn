var  project    = require('./package.json'),
gulp            = require('gulp'),
sass            = require('gulp-sass')(require('sass'));
autoPrefixer    = require('gulp-autoprefixer'),
wpPot           = require('gulp-wp-pot'),
clean           = require('gulp-clean'),
zip             = require('gulp-zip');
rtlcss 			= require('gulp-rtlcss');
gulpfilter 		= require('gulp-filter');
rename 			= require("gulp-rename");
sass.compiler 	= require('node-sass');
concat 			= require('gulp-concat');
fileinclude 	= require('gulp-file-include');

const paths = {
	scripts: {
		src: './src/pages/',
		dest: './'
	}
};

gulp.task('includeHTML', function () {
	return gulp.src([
		'src/pages/*.html'
	])
	.pipe(fileinclude({
		prefix: '@@',
		basepath: '@file'
	}))
	.pipe(gulp.dest(paths.scripts.dest));
});

gulp.task('sass', function () {
	return gulp.src(['style.scss', 'header.scss', 'sidebar.scss', 'content.scss'], {cwd: 'src/sass'})
	.pipe(sass({outputStyle: 'expanded'}).on('error', sass.logError))
	.pipe(autoPrefixer({ browsers: ["> 1%", "last 2 versions"] }))
	.pipe(gulp.dest('assets/css/'))
});

gulp.task('js', function () {
	return gulp.src(['main.js'], {cwd: 'src/js'})
	// .pipe(concat('main.js'))
	.pipe(gulp.dest('assets/js/'))
});

gulp.task('clean', function () {
	return gulp.src('__build/*.*', {read: false})
	.pipe(clean());
});

gulp.task('zip', function () {
	return gulp.src(['**', '!__*/**', '!node_modules/**', '!src/**', '!gulpfile.js', '!.DS_Store', '!package.json', '!package-lock.json'], { base: '..' })
	.pipe(zip(project.name+'.zip'))
	.pipe(gulp.dest('__build'));
});

// rtl css generator
gulp.task('rtl', function(done) {
	const bootstrap = gulpfilter('**/bootstrap.css', { restore: true });
	const style = gulpfilter('**/style.css', { restore: true });
	const header = gulpfilter('**/header.css', { restore: true });
	const sidebar = gulpfilter('**/sidebar.css', { restore: true });
	const content = gulpfilter('**/content.css', { restore: true });

	gulp.src(['assets/vendor/css/bootstrap/bootstrap.css', 'assets/css/style.css', 'assets/css/header.css', 'assets/css/sidebar.css', 'assets/css/content.css'])
			.pipe(
				rtlcss({
					stringMap: [
						{
							name: 'left-right',
							priority: 100,
							search: ['left', 'Left', 'LEFT'],
							replace: ['right', 'Right', 'RIGHT'],
							options: {
								scope: '*',
								ignoreCase: false,
							},
						},
						{
							name: 'ltr-rtl',
							priority: 100,
							search: ['ltr', 'Ltr', 'LTR'],
							replace: ['rtl', 'Rtl', 'RTL'],
							options: {
								scope: '*',
								ignoreCase: false,
							},
						},
					],
				})
			)
			.pipe(bootstrap)
			.pipe(rename({ suffix: '-rtl', extname: '.css' }))
			.pipe(gulp.dest('assets/vendor/css/bootstrap/'))
			.pipe(bootstrap.restore)
			.pipe(style)
			.pipe(rename({ basename: "style", suffix: '-rtl', extname: '.css' }))
			.pipe(gulp.dest('assets/css/'))
			.pipe(style.restore)
			.pipe(header)
			.pipe(rename({ basename: "header", suffix: '-rtl', extname: '.css' }))
			.pipe(gulp.dest('assets/css/'))
			.pipe(header.restore)
			.pipe(sidebar)
			.pipe(rename({ basename: "sidebar", suffix: '-rtl', extname: '.css' }))
			.pipe(gulp.dest('assets/css/'))
			.pipe(sidebar.restore)
			.pipe(content)
			.pipe(rename({ basename: "content", suffix: '-rtl', extname: '.css' }))
			.pipe(gulp.dest('assets/css/'))
			.pipe(content.restore);
	done();
});

gulp.task('watch', function() {
	gulp.watch('src/sass/*.scss', gulp.series('sass'));
	gulp.watch('src/js/*.js', gulp.series('js'));
    gulp.watch(['src/**/*.html'], gulp.series('includeHTML'));
});

gulp.task('run', gulp.parallel('sass', 'js', 'includeHTML'));
gulp.task('build', gulp.series('run','clean','zip'));

gulp.task('default', gulp.series('run','watch'));