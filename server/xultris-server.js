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
  - ***** END LICENSE BLOCK ***** -->
*/

PORT = 10228;
HOST = "xultris.bri.kz";
SESSION_TIMEOUT = 60 * 1000;
VERSION = "2.0";
PROTOCOL = "2.0";

var sys = require('sys');
var net = require('net');

var sessions = {};

var server = net.createServer(function(stream)
{
    stream.setEncoding("utf8");

    stream.on("connect", function ()
    {
        sys.log("[xultris-server] " + (new Date()) + ": new connection from " + stream.remoteAddress);

        //stream.setEncoding("ascii");

        var session = {
            nick: "",
         
            id: Math.floor(Math.random()*9999).toString(),
         
            timestamp: new Date(),

            opponent: null,

            stream: null,
         
            poke: function ()
            {
               session.timestamp = new Date();
            },

            destroy: function ()
            {
                if (!sessions[session.id])
                    return;

                sys.log("destroying a session");

                try
                {
                    sessions[session.id].stream.end();
                    sessions[session.id].stream = null;
                } catch (e) {}

                if (sessions[session.id].opponent)
                {
                    try
                    {
                        sessions[session.id].opponent.stream.end();
                        sessions[session.id].opponent.stream = null
                    } catch (e) {}

                    delete sessions[sessions[session.id].opponent.id];
                }

                delete sessions[session.id];
            }
        };
        
        session.nick = "Player " + session.id;

        sessions[session.id] = session;
        //stream.write("Welcome to Xultris Server v" + VERSION + "\r\n");

        stream.session = session;
        session.stream = stream;
    });

    stream.on("data", function (data)
    {
        try
        {
            stream.session.poke();

            var cs = data.indexOf(" ");

            if (cs > 0)
            {
                var command = data.substring(0,cs);
                var payload = data.substring(cs+1,data.length-2);

                sys.log("received '" + command + "' command with payload '" + payload + "'");

                if (command == "nick")
                {
                    var nick = payload.replace(/[^\w ]/g, "", "g").substring(0, 32);

                    if (nick != "")
                    {
                        stream.session.nick = nick;
                    }

                    stream.write("nick " + stream.session.nick + "\r\n");
                }
                else if (command == "protocol")
                {
                    stream.write("protocol " + PROTOCOL + "\r\n");

                    if (payload != PROTOCOL)
                    {
                        stream.session.destroy();
                        stream.end();
                    }
                }
                else if (command == "play")
                {
                    stream.session.opponent = null;

                    for (var id in sessions)
                    {
                        if (!sessions.hasOwnProperty(id)) continue;
                        var asession = sessions[id];

                        if (id == payload)
                        {
                            stream.session.opponent = asession;
                            stream.session.opponent.opponent = stream.session;
                            break;
                        }
                    }

                    if (stream.session.opponent)
                    {
                        stream.write("playing " + stream.session.opponent.nick + "\r\n");
                        stream.session.opponent.stream.write("playing " + stream.session.nick + "\r\n");
                    }
                    else
                    {
                        stream.write("error opponent '" + payload + "' not found\r\n");
                    }
                }
                else if (command == "send")
                {
                    if (stream.session.opponent && stream.session.opponent.stream)
                    {
                        // TODO max size of payload here
                        stream.session.opponent.stream.write("send " + payload + "\r\n");
                        //stream.write("ok\r\n");
                    }
                    else
                    {
                        stream.write("error opponent not found\r\n");
                    }
                }
                else if (command == "sync")
                {
                    if (stream.session.opponent && stream.session.opponent.stream)
                    {
                        // TODO max size of payload here
                        try
                        {
                            stream.session.opponent.stream.write("sync " + payload + "\r\n");
                        } catch (e)
                        {
                            sys.log("got exception while syncing with opponent, will kill game.");
                            stream.session.destroy();
                            stream.session.opponent.destroy();
                        }
                        //stream.write("ok\r\n");
                    }
                    else
                    {
                        stream.write("error opponent not found\r\n");
                    }
                }
                else
                {
                    stream.write("error opponent not found\r\n");
                }
            }
            else
            {
                var command = data.substring(0,data.length-2);

                var mc = command.split(/\r\n/);
                if (mc.length>1)
                command = mc[0];

                sys.log("received '" + command + "' command");

                if (command == "ping")
                {
                    stream.write("pong\r\n");
                }
                else if (command == "pause")
                {
                    if (stream.session.opponent && stream.session.opponent.stream)
                    {
                        stream.session.opponent.stream.write("pause\r\n");
                    }
                }
                else if (command == "unpause")
                {
                    if (stream.session.opponent && stream.session.opponent.stream)
                    {
                        stream.session.opponent.stream.write("unpause\r\n");
                    }
                }
                else if (command == "iwin")
                {
                    stream.write("goodbye\r\n");

                    if (stream.session.opponent && stream.session.opponent.stream)
                    {
                        stream.session.opponent.stream.write("youlose\r\n");
                    }

                    stream.session.destroy();
                    stream.end();
                }
                else if (command == "ilose")
                {
                    stream.write("goodbye\r\n");

                    if (stream.session.opponent && stream.session.opponent.stream)
                    {
                        stream.session.opponent.stream.write("youwin\r\n");
                    }

                    stream.session.destroy();
                    stream.end();
                }
                else if (command == "quit")
                {
                    stream.write("goodbye\r\n");

                    if (stream.session.opponent && stream.session.opponent.stream)
                    {
                        stream.session.opponent.stream.write("youwin\r\n");
                    }

                    stream.session.destroy();
                    stream.end();
                }
                else if (command == "list")
                {
                    var payload = "list ";

                    for (var id in sessions)
                    {
                        if (!sessions.hasOwnProperty(id)) continue;
                        var asession = sessions[id];

                        if (id != stream.session.id && !asession.opponent)
                        {
                            payload += asession.id + "=" + asession.nick + "|";
                        }
                    }

                    stream.write(payload + "\r\n");
                }
                else
                {
                    stream.write("error unknown command '" + command + "'\r\n");
                }
            }
        }
        catch (e)
        {
            sys.log("[xultris-server] caught exception: '" + e + "'");
        }
    });

    stream.on("end", function ()
    {
        stream.session.destroy();
        stream.end();
    });
});

server.listen(PORT, HOST);
sys.log("[xultris-server] " + (new Date()) + ": new server started on " + HOST + ":" + PORT);

setInterval(function ()
{
    var now = new Date();
    var sessioncount=0;

    for (var id in sessions)
    {
        if (!sessions.hasOwnProperty(id)) continue;
        var session = sessions[id];

        if (now - session.timestamp > SESSION_TIMEOUT)
        {
            session.destroy();
        }
        else
        {
            sessioncount++;
        }
    }

    sys.log("[xultris-server] " + (new Date()) + ": have " + sessioncount + " active sessions");
}, 1000);

