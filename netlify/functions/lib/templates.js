const fs = require('fs');
const path = require('path');

function loadTemplate(templateName) {
    const templatePath = path.join(__dirname, '..', 'templates', `${templateName}.html`);
    return fs.readFileSync(templatePath, 'utf8');
}

function renderTemplate(templateName, data) {
    let html = loadTemplate(templateName);

    // Replace placeholders with actual values
    for (const [key, value] of Object.entries(data)) {
        const placeholder = `{{${key}}}`;
        html = html.replace(new RegExp(placeholder, 'g'), value);
    }

    return html;
}

module.exports = {
    loadTemplate,
    renderTemplate
};
