// ШРИФТЫ и переделать js
// и к изображениям на продакшн добавить сжатие

'use strict';

const dev = './dev';
const build = './build';

const { src, dest, parallel, series, watch } = require('gulp');
const gulpif = require('gulp-if');	// 
const replace = require('gulp-replace'); // Для замены строк по шаблону или регулярке
const browsersync = require('browser-sync').create();
const plumber = require('gulp-plumber'); // для отслеживания ошибок
const notify = require('gulp-notify');	// для показа уведомлений
const sourcemaps = require('gulp-sourcemaps'); // создает sourcemap файлы
const rename = require('gulp-rename');	// позволяет переименовывать файлы
const del = require('del');	// нужен чтобы удалить каталог с файлами
const argv = require('yargs').argv;	// для передачи и чтения параметров

// STYLES
const sass = require('gulp-sass'); // препроцессор sass и scss
const shorthand = require('gulp-shorthand');	// сокращает стили
const autoprefixer = require('gulp-autoprefixer'); // автоматическая расстановка префиксов для старых браузеров например webkit, -ms, -o, -moz
const cleanCss = require('gulp-clean-css');	// минифицирует css

// HTML

// для инклудов в html
// <!-- include header -->
// @@//= header.html
// <!-- end include header -->
const rigger = require('gulp-rigger');
const validator = require('gulp-html'); // Валидатор html ( нужен JAVA SE для работы )
const htmlmin = require('gulp-htmlmin'); // минифицирует html

// JS
const concat = require('gulp-concat'); // для конкатенации
const babel = require('gulp-babel');	// 
const uglify = require('gulp-uglify-es').default; // делает js тяжело читаемым

// SVG
const svgsprites = require('gulp-svg-sprite');
const cheerio = require('gulp-cheerio'); // для удаления лишних атрибутов с svg

// Images
const webp = require('gulp-webp'); // Корвертация изображений в webp
const imagemin = require('gulp-imagemin');	// сжатие изображений
const imageminGiflossy = require('imagemin-giflossy'); // для сжатия gif изображений
const imageminPngquant = require('imagemin-pngquant');	// для png
const imageminZopfli = require('imagemin-zopfli'); // 
const imageminMozjpeg = require('imagemin-mozjpeg'); // 

// Fonts
const ttf2woff = require('gulp-ttf2woff');
const ttf2woff2 = require('gulp-ttf2woff2');

// для продакшена
const isProduction = !!argv.production;
const webPackMode = argv.production === true ? 'production' : 'development';

const styles = () => {
	return src(`${dev}/sass/*.+(scss|sass)`)
		.pipe(gulpif(!isProduction, sourcemaps.init()))
		.pipe(sass( { outputStyle: 'expanded' } ).on('error', notify.onError({
			title: 'Sass Error',
			message: '<%= error.message %>'
		})))
		.pipe(autoprefixer( { cascade: false } ))
		.pipe(gulpif(isProduction, shorthand()))
		.pipe(gulpif(isProduction,cleanCss( { level: 2 } )))
		.pipe(gulpif(isProduction,rename( { suffix: '.min' } )))
		.pipe(gulpif(!isProduction, sourcemaps.write('.')))
		.pipe(dest(`${build}/css/`))
		.pipe(browsersync.stream())
}

const html = () => {
	return src(`${dev}/html/pages/*.html`)
		.pipe(plumber())
		.pipe(rigger())
		.pipe(gulpif(isProduction, validator().on('error', notify.onError({
			title: 'Html Validator Error',
			message: '<%= error.message %>'
		}))))
		.pipe(gulpif(isProduction, htmlmin({ collapseWhitespace: true }))) // без этого параметра не минифицирует
		.pipe(gulpif(isProduction, replace('css/main.css', 'css/main.min.css')))
		.pipe(gulpif(isProduction, replace('css/vendor.css', 'css/vendor.min.css')))
		.pipe(gulpif(isProduction, replace('js/main.js', 'js/main.min.js')))
		.pipe(dest(`${build}/`))
		.pipe(browsersync.stream());
}

const js = () => {
	return src(`${dev}/js/**/**.js`)
		.pipe(plumber())
		.pipe(babel({
			presets: ['@babel/env']
		}))
		.pipe(concat('main.js'))
		.pipe(gulpif(!isProduction, sourcemaps.init()))
		.pipe(gulpif(isProduction, uglify().on("error", notify.onError({
			title: 'Uglify Js Error',
			message: '<%= error.message %>'
		}))))
		.pipe(gulpif(!isProduction, sourcemaps.write('.')))
		.pipe(dest(`${build}/js/`))
		.pipe(browsersync.stream())
}

const svg = () => {
	return src(`${dev}/img/svg/**.svg`)
		.pipe(plumber())
		.pipe(cheerio({ // Удаляем атрибуты style, fill и stroke из иконок, для того чтобы они не перебивали стили, заданные через css
			run: function ($) {
				$('[fill]').removeAttr('fill');
				$('[stroke]').removeAttr('stroke');
				$('[style]').removeAttr('style');
			},
			parserOptions: { xmlMode: true }
		}))
		.pipe(replace('&gt;', '>')) // у cheerio бывает баг, пофиксим его
		.pipe(svgsprites({
			mode: {
				symbol: {
					sprite: "../sprite.svg",
				}
			}
		}))
		.pipe(dest(`${build}/img`));
}

const img = () => {
	return src(`${dev}/img/*.+(gif|jpg|png|jpeg|web2|svg)`)
		.pipe(gulpif(isProduction, imagemin([
			imageminGiflossy({
				optimizationLevel: 3,
				optimize: 3,
				lossy: 2
			}),
			imageminPngquant({
				speed: 5,
				quality: [0.6, 0.8]
			}),
			imageminZopfli({
				more: true
			}),
			imageminMozjpeg({
				progressive: true,
				quality: 90
			}),
			imagemin.svgo({
				plugins: [
					{ removeViewBox: false },
					{ removeUnusedNS: false },
					{ removeUselessStrokeAndFill: false },
					{ cleanupIDs: false },
					{ removeComments: true },
					{ removeEmptyAttrs: true },
					{ removeEmptyText: true },
					{ collapseGroups: true }
				]
			})
		])))
		.pipe(dest(`${build}/img`));
}

// из папки img/webp преобразовывает картинки в webp
const webP = () => {
	return src(`${dev}/img/webp/*.+(jpg|png|tiff|webp)`)
		.pipe(plumber())
		.pipe(webp({
			quality: 90
		}))
		.pipe(dest(`${build}/img`))
}

const resources = () => {
	return src(`${dev}/resources/**)`)
		.pipe(dest(`${build}/resources`));
}

const fonts = () => {
	src(`${dev}/fonts/*.ttf`)
		.pipe(ttf2woff())
		.pipe(dest(`${build}/fonts`));

	return src(`${dev}/fonts/*.ttf`)
		.pipe(ttf2woff2())
		.pipe(dest(`${build}/fonts`));
}

const clean = () => {
	return del(`${build}/*`);
}

const watches = () => {
	browsersync.init({
		server: {
			baseDir: build
		},
		tunnel: 'mygulpsite2',
		port: 3000,
		notify: false,
		online: true,
	});

	watch(`${dev}/sass/**/**.+(scss|sass)`, styles);
	watch(`${dev}/**/**.html`, html);
	watch(`${dev}/js/**/**.js`, js);
	watch(`${dev}/img/svg/**.svg`, svg);
	watch(`${dev}/img/*.+(gif|jpg|png|jpeg|web2|svg)`, img);
	watch(`${dev}/img/webp/*.+(jpg|png|tiff|webp)`, webP);
	watch(`${dev}/resources/**`, img);
}

exports.styles = styles;
exports.html = html;
exports.js = js;
exports.svg = svg;

exports.default = series(clean, resources, fonts, img, webP, svg, html, js, styles, watches);