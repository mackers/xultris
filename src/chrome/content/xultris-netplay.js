function NetPlayer()
{

this.netHost = "localhost";
this.netPort = 7000;
this.protocol = "2.0";

this.connected = false;
//this.waiting = false;
//this.serverSocket = null;

this.alias = "";

this.instream = null;
this.outstream = null;

this.dataListener = {
	onStartRequest: function(request, context) {},
	onStopRequest: function(request, context, status)
	{
        try
        {
            netPlayer.onOtherPlayerQuit();
        } catch (e) {}
        // TODO
		//netPlayer.disconnect();
	},
	onDataAvailable: function(request, context, inputStream, offset, count)
	{
		if (!netPlayer) return;

        var handleResponse = function(data)
        {
            if (!data)
                return;

            var space = data.indexOf(" ");
            var resp, payload;

            if (space == -1)
            {
                resp = data.trim();
                payload = "";
            }
            else
            {
                resp = data.substring(0, space).trim();
                payload = data.substring(space+1).trim();
            }

            dump("server sent response '" + resp + "' with payload '" + payload + "'\n"); 
            
            if (resp == 'protocol')
            {
                if (payload != netPlayer.protocol)
                    return netPlayer.onProtocolMismatch();

                netPlayer.changeNick(netPlayer.alias);
            }
            else if (resp == 'nick')
            {
                netPlayer.onChangeNick(payload);

                netPlayer.listAvailablePlayers();
            }
            else if (resp == 'list')
            {  
                if (payload == '')
                    netPlayer.onListAvailablePlayers(null);

                // payload looks like: list 1946=ook ook|
                var bits = payload.split("|");
                var players = [];

                for (var i=0; i<bits.length; i++)
                {
                    var bits2 = bits[i].split("=");
                    if (bits2[1])
                        players.push({id: bits2[0], name: bits2[1]});
                }

                if (players != null && players.length == 0)
                    players = null;

                netPlayer.onListAvailablePlayers(players);
            }
            else if (resp == 'playing')
            {
                netPlayer.onStartPlaying(payload);
            }
            else if (resp == 'send')
            {
                netPlayer.onReceiveLines(parseInt(payload));
            }
            else if (resp == 'sync')
            {
                // TODO
            }
            else if (resp == 'youwin')
            {
                netPlayer.onYouWin();
            }
            else if (resp == 'youlose')
            {
                netPlayer.onYouLose();
            }
            else if (resp == 'pause')
            {
                netPlayer.onPause();
            }
            else if (resp == 'unpause')
            {
                netPlayer.onUnpause();
            }
            else if (resp == 'goodbye')
            {
                netPlayer.onGoodbye();
            }
            else
            {
                //return netPlayer.onGeneralError();
            }
        };

		var rawdata = netPlayer.instream.read(count);
        var bits = rawdata.split(/\r\n/);

        for (var i=0; i<bits.length; i++)
            handleResponse(bits[i]);
	}
};

/*
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

            netPlayer.sendProtocol();
		}
		catch
		{ 
			netPlayer.win.alert(e);
		}

		var pump = Components. classes["@mozilla.org/network/input-stream-pump;1"].createInstance(Components.interfaces.nsIInputStreamPump);
		pump.init(stream, -1, -1, 0, 0, false);
		pump.asyncRead(netPlayer.dataListener,netPlayer);
	},
	onStopListening : function(socket, status) {}
};
*/

this.init = function()
{
	this.connected = false;
}

this.isConnected = function()
{
	return this.connected;
}

/*
this.isWaiting = function()
{
	return this.waiting;
}
*/

this.connectToServerAndListAvailablePlayers = function()
{
	try
	{
		var transportService = Components.classes["@mozilla.org/network/socket-transport-service;1"].getService(Components.interfaces.nsISocketTransportService);
		var transport = transportService.createTransport(null,0,this.netHost,this.netPort,null);

		this.outstream = transport.openOutputStream(0,0,0);

		var stream = transport.openInputStream(0,0,0);
		this.instream = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
		this.instream.init(stream);

		var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"].createInstance(Components.interfaces.nsIInputStreamPump);
		pump.init(stream, -1, -1, 0, 0, false);
		pump.asyncRead(this.dataListener,netPlayer);

        setTimeout(netPlayer.sendProtocol, 200);
        netPlayer.connected = true;
	}
	catch (e)
	{
        netPlayer.onCannotConnectToServer(e);
	}	
}

this.disconnect = function()
{
	this.connected = false;

	if (this.outstream) this._sendData("quit");

	if (this.outstream) this.outstream.close();
	if (this.instream) this.instream.close();

    this.outstream = null;
    this.instream = null;
}

this._sendData = function(data)
{
	if (!this.outstream) return;
    dump("sending data to server: '" + data + "'\n");
	this.outstream.write(data+"\r\n", data.length+2);
}

this.sendProtocol = function()
{
    netPlayer._sendData("protocol " + netPlayer.protocol);
}

this.changeNick = function(nick)
{
    netPlayer._sendData("nick " + nick);
}

this.listAvailablePlayers = function()
{
    netPlayer._sendData("list");
}

this.choosePlayer = function(playerId)
{
    netPlayer._sendData("play " + playerId);
}

this.pushLines = function(numLines)
{
	netPlayer._sendData("send " + numLines);
}

this.pushPause = function()
{
	netPlayer._sendData("pause");
}

this.pushUnpause = function()
{
	netPlayer._sendData("unpause");
}

this.pushWin = function()
{
	netPlayer._sendData("iwin");
}

this.pushLose = function()
{
	netPlayer._sendData("ilose");
}


/*
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
*/

}

