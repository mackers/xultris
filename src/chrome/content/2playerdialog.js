var netPlayer;

function startup()
{
	netPlayer = window.arguments[0];

	netPlayer.win = window;
}

function server()
{
	setInfoText("Starting server...");

	if (netPlayer.startServer())
	{
		setInfoText("Waiting for incoming connection...");
	}
	else
	{
		setInfoText("Could not start server.");
	}
}

function client()
{
	var host = window.prompt("Please enter Player 2's IP address:", netPlayer.lastHost);
	if (host == null) return;

	setInfoText("Connecting to '" + host + "' ...");

	if (netPlayer.startClient(host))
	{
	}
	else
	{
		setInfoText("Could not connect to host.");
	}
}

function cancel()
{
	if (netPlayer.isWaiting()) netPlayer.disconnect();
	window.close();
}

function setInfoText(t)
{
        document.getElementById("infotext").setAttribute("value",t);
}
