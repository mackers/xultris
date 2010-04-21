play:
	cp src/chrome/content/* ../www/xultris/play/

xpi:
	cd src && find . | grep -v CVS | xargs zip ../../downloads/xultris.xpi
