const ascii = require('ascii-table');
const fs = require('fs');
const path = require('path');

function loadEvents(client) {
    const table = new ascii().setHeading('Events', 'Status');
    const eventsPath = path.join(__dirname, '..', 'events');
    function loadEvent(filePath) {
        const event = require(filePath);
        if (event.rest) {
            if (event.once)
                client.rest.once(event.name, (...args) => event.execute(...args, client));
            else
                client.rest.on(event.name, (...args) => event.execute(...args, client));
        } else {
            if (event.once)
                client.once(event.name, (...args) => event.execute(...args, client));
            else 
                client.on(event.name, (...args) => event.execute(...args, client));
        }
        table.addRow(path.basename(filePath), '✅');
    }

    const eventFiles = fs.readdirSync(eventsPath);

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            const files = fs.readdirSync(filePath).filter((f) => f.endsWith(".js"));
            for (const nestedFile of files) {
                loadEvent(path.join(filePath, nestedFile));
            }
        } else if (file.endsWith('.js')) {
            loadEvent(filePath);
        }
    }

    console.log(table.toString(), "\nLoaded events");
}

module.exports = { loadEvents };