/* ***** BEGIN LICENSE BLOCK *****
  -   Version: MPL 1.1/GPL 2.0/LGPL 2.1
  -
  - The contents of this file are subject to the Mozilla Public License Version
  - 1.1 (the "License"); you may not use this file except in compliance with
  - the License. You may obtain a copy of the License at
  - http://www.mozilla.org/MPL/
  - 
  - Software distributed under the License is distributed on an "AS IS" basis,
  - WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
  - for the specific language governing rights and limitations under the
  - License.
  -
  - The Original Code is briks.
  -
  - Portions created by the Initial Developer are Copyright (C) 2008
  - the Initial Developer. All Rights Reserved.
  -
  - Contributor(s): David McNamara
  -                 David Gillen
  -                 Mike Schuette
  -
  - Alternatively, the contents of this file may be used under the terms of
  - either the GNU General Public License Version 2 or later (the "GPL"), or
  - the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
  - in which case the provisions of the GPL or the LGPL are applicable instead
  - of those above. If you wish to allow use of your version of this file only
  - under the terms of either the GPL or the LGPL, and not to allow others to
  - use your version of this file under the terms of the MPL, indicate your
  - decision by deleting the provisions above and replace them with the notice
  - and other provisions required by the GPL or the LGPL. If you do not delete
  - the provisions above, a recipient may use your version of this file under
  - the terms of any one of the MPL, the GPL or the LGPL.
  - 
  - ***** END LICENSE BLOCK ***** */

function NetPlayer()
{
    this.netHost = ""; // read from pref;
    this.netPort = 7000;
    this.protocol = "2.0";

    this.connected = false;
    this.handshake = false;

    this.alias = "";

    this.instream = null;
    this.outstream = null;

    this.dataListener = {
        onStartRequest: function(request, context) {},
        onStopRequest: function(request, context, status)
        {
            try
            {
                if (netPlayer.handshake)
                {
                    netPlayer.onOtherPlayerQuit();
                }
                else
                {
                    netPlayer.onCannotConnectToServer();
                }
                
            } catch (e) { dump(e + "\n"); }
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

                //dump("server sent response '" + resp + "' with payload '" + payload + "'\n"); 
                
                if (resp == 'protocol')
                {
                    if (payload != netPlayer.protocol)
                        return netPlayer.onProtocolMismatch();

                    netPlayer.handshake = true;
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
                    netPlayer.onSync(payload);
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

    this.init = function()
    {
        this.connected = false;
        this.handshake = false;
    }

    this.isConnected = function()
    {
        return this.connected;
    }

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
        this.handshake = false;

        if (this.outstream) this._sendData("quit");

        if (this.outstream) this.outstream.close();
        if (this.instream) this.instream.close();

        this.outstream = null;
        this.instream = null;
    }

    this._sendData = function(data)
    {
        if (!this.outstream) return;
        //dump("sending data to server: '" + data + "'\n");

        try
        {
            this.outstream.write(data+"\r\n", data.length+2);
        }
        catch (e) {}
    }

    this.sync = function(data)
    {
        netPlayer._sendData("sync " + data);
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
}

