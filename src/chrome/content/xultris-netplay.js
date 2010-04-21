function NetPlayer()
{

this.netPort = 2778;
this.connected = false;
this.waiting = false;
this.serverSocket = null;
this.win = window;
this.lastHost = "";

this.instream = null;
this.outstream = null;

this.dataListener = {
	onStartRequest: function(request, context) {},
	onStopRequest: function(request, context, status)
	{
		if (!netPlayer) return;

		netPlayer.disconnect();
	},
	onDataAvailable: function(request, context, inputStream, offset, count)
	{
		if (!netPlayer) return;

		var data = netPlayer.instream.read(count);
		
		var command = data.substr(0,4);
		var args = data.substr(5);

		if (command == 'HELO')
		{
			// TODO version control here
			netPlayer.doneHandshake();
		}
		else if (command == 'LINE')
		{
			addJunk(args);
		}
		else if (command == 'UWIN')
		{
			gameOverMan(true);
		}
		else if (command == 'PAUS')
		{
			pause(false, true);
		}
		else if (command == 'UNPS')
		{
			pause(true, true);
		}
	}
};

this.listener =
{
	onSocketAccepted : function(socket, transport)
	{
		var stream;

		try
		{
			netPlayer.outstream = transport.openOutputStream(0,0,0);

			stream = transport.openInputStream(0,0,0);
			netPlayer.instream = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream)
			netPlayer.instream.init(stream);
		
			netPlayer.serverSocket.close();

			netPlayer.startHandshake();

		}
		catch(e)
		{ 
			netPlayer.win.alert(e);
		}

		var pump = Components. classes["@mozilla.org/network/input-stream-pump;1"].createInstance(Components.interfaces.nsIInputStreamPump);
		pump.init(stream, -1, -1, 0, 0, false);
		pump.asyncRead(netPlayer.dataListener,netPlayer);
	},
	onStopListening : function(socket, status) {}
};

this.init = function()
{
	this.connected = false;
	this.waiting = false;
	this.lastHost = "";
}

this.isConnected = function()
{
	return this.connected;
}

this.isWaiting = function()
{
	return this.waiting;
}

this.startClient = function(host)
{
	this.lastHost = host;

	try
	{
		var transportService = Components.classes["@mozilla.org/network/socket-transport-service;1"].getService(Components.interfaces.nsISocketTransportService);
		var transport = transportService.createTransport(null,0,host,this.netPort,null);

		this.outstream = transport.openOutputStream(0,0,0);
		this.startHandshake();

		var stream = transport.openInputStream(0,0,0);
		this.instream = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
		this.instream.init(stream);

		var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"].createInstance(Components.interfaces.nsIInputStreamPump);
		pump.init(stream, -1, -1, 0, 0, false);
		pump.asyncRead(this.dataListener,netPlayer);

		return true;
	}
	catch (e)
	{
		return false;
	}	
}

this.startServer = function()
{
	this.waiting = true;
	this.connected = false;

	try
	{
		this.serverSocket = Components.classes["@mozilla.org/network/server-socket;1"].createInstance(Components.interfaces.nsIServerSocket);
		this.serverSocket.init(this.netPort,false,-1);

		this.serverSocket.asyncListen(this.listener);

		return true;
	}
	catch (e)
	{
		this.waiting = false;
		return false;
	}
}

this.writeMessage = function(message)
{
	if (!this.outstream) return;
	this.outstream.write(message+"\n", message.length+1);
}

this.startHandshake = function()
{
	this.writeMessage("HELO " + version);
}

this.doneHandshake = function()
{
	this.connected = true;
	this.waiting = false;

	this.win.close();
}

this.disconnect = function()
{
	if (this.outstream) this.outstream.close();
	if (this.instream) this.instream.close();
	if (this.serverSocket) this.serverSocket.close();

	this.waiting = false;
	this.connected = false;

	if (this.win.document && this.win.document.getElementById("connected"))
	{
		this.win.document.getElementById("connected").setAttribute("style","display: hidden;");
	}
}

this.pushPause = function()
{
	this.writeMessage("PAUS");
}

this.pushUnpause = function()
{
	this.writeMessage("UNPS");
}

this.pushWin = function()
{
	this.writeMessage("UWIN");
	this.disconnect();
}

this.pushLines = function(numLines)
{
	this.writeMessage("LINE " + numLines);
}

}

/*
function clientStart() {
	mDump("Starting client");
	p2ip=window.prompt("Please enter Player 2's IP address:");
	if (p2ip==null) return;
	netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
	gameOverMan();
	setInfoText("Connecting...");
	theSocket = new Socket();
	theSocket.open(p2ip,netPort); // doesn't mean it worked!
	mDump("Connection with "+p2ip+":"+netPort+" opened");
	//try {
	//	theSocket.async(window.process);
		//theSocket.write("<xultris:xultris protocol='xultris-1.0'>\n");
		netplayWrite("<xultris:xultris protocol='xultris-2.2'>");
		var hs1=theSocket.read(netTimeOut);
		mDump("in: "+hs1);
		if (hs1=="") {
			alert("Couldn't open connection with "+p2ip+":"+netPort);
			xultrisSocketCancelAll();
			return;
		}
		setInfoText("Connected!!!");
		if (hs1.indexOf("<xultris:xultris")!=0) {
			alert("Unknown protocol! ("+hs1+")");
			xultrisSocketCancelAll();
			return;
		}
		hs1=hs1.substring(27,38);
		if (hs1!="xultris-1.0") {
			alert("Incompatible protocol version ("+hs1+")");
			xultrisSocketCancelAll();
			return;
		}
	//} catch (ex) {
	//	dump("An unknown socket error occured\n");
	//}
	document.getElementById("connected").setAttribute("style","display: block;");
	is2player=true;
	newGame();
}

function xultrisSocketError() {
	alert("An error occured while connecting to "+p2ip+":"+netPort);
}

function xultrisSocketCancelAll() {
	clearInfoText();
}

function netplayTransferLines(num) {
	//dump("sending netplay lines: "+num+"\n");
	var theHole=Math.floor(Math.random()*widthofgrid)
	//theSocket.write("<xultris:lines quantity='"+num+"' hole='"+theHole+"'/>\n");
	netplayWrite("<xultris:lines quantity='"+num+"' hole='"+theHole+"'/>");
}

function netplayReadLine() {
    var thisLine;
    var tl;

    if (((tl=theSocket.read(netTimeOut))!=null)&&(tl!="")) {
       thisLine = tl;
    }
    else
    {
    }
    else
    {
      return;
    }

    mDump("in: "+thisLine);

	if (thisLine.indexOf("<xultris:lines")==0) {
		netplayAddLines(thisLine.substring(25,26),thisLine.substring(34,35));
	} else if (thisLine.indexOf("<xultris:pause/>")==0) {
		pause();
	} else if (thisLine.indexOf("<xultris:unpause/>")==0) {
		pause(true);
	} else if (thisLine.indexOf("<xultris:youwin/>")==0) {
		gameOverMan(true);
	} else if (thisLine.indexOf("</xultris:xultris>")==0) {
		theSocket.close();
	}
}

function netplayHandshake() {
	netplayWrite("<xultris:xultris protocol='xultris-2.2'>");
}

function netplayDisconnect() {
	//theSocket.write("</xultris:xultris>\n");
	netplayWrite("</xultris:xultris>");
	document.getElementById("connected").setAttribute("style","");
	theSocket.close();
}

function netplayWrite(str) {
	//if (!is2player) return;

	if (theSocket)
	{
		theSocket.write(str+"\n");
	}
	else if (outstream)
	{
		outstream.write(str+"\n", str.length+1);
	}

	if (debug) mDump ("out: "+str);
}
*/
