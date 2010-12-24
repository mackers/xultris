xpi:
	rm -f xultris.xpi
	cd src && find . | grep -v CVS |  grep -v .DS_Store | xargs zip ../xultris.xpi
