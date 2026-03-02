import fs from "fs";
import commandLineArgs from 'command-line-args';
import Diff from 'text-diff';

/*
This script turns a JSON file of card text diffs into HTML suitable for including on https://netrunnerdb.com/en/rules_text_updates

    npm run build
    node dist/make-html-text-diffs.js --diff_file path/to/diffs.json > diffs.fragment.html
    or
    node dist/make-html-text-diffs.js --diff_file path/to/diffs.json --full_file=true > diffs.full.html

Output is written to STDOUT.

To generate the JSON file, use generate-text-diffs.sh like this:

./generate-text-diffs.sh c573eba782df594f894e9df6d7798d1e475dd28e a6a2cd901f9856ad6e766186aca9810bc24cf979 > diffs.json
or
./generate-text-diffs.sh old-branch-name new-branch-name > diffs.json
*/

const optionDefinitions = [
  { name: 'diff_file', description: 'Input file containing the diffs from a Rules Text Update.', alias: 'd', type: String },
  { name: 'full_file', description: 'Generate a complete HTML file for preview, instead of a fragment.', alias: 'f', type: Boolean },
];
const options = commandLineArgs(optionDefinitions);

if (!options.diff_file) {
  console.error("You must provide a path to the JSON file with the diffs with --diff_file or -d .");
  process.exit(1);
}
const diff_file = JSON.parse(fs.readFileSync(options.diff_file, "utf-8"));

const diff = new Diff(); // options may be passed to constructor; see below

const header = `
<html>
<head>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-SgOJa3DmI69IUzQ2PVdRZhwQ+dy64/BUtbMJw1MZ8t5HZApcHrRKUc4W0kG879m7" crossorigin="anonymous">
<style>
  .break{
      display:block;
      margin:0 0 .8em;
  }
  del { background-color: #cf00ff87 }
  ins { background-color: #b8f2b8}
</style>
</head>
<body>
<div class="container text-center">
`;

const footer = `
  </div>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/js/bootstrap.bundle.min.js" integrity="sha384-k6d4wzSIapyDyv1kpU366/PK5hCdSbCRGRCMv+eplOQJWyd1fbcAu9OCUj5zNLiq" crossorigin="anonymous"></script>
</body>
</html>
`;

if (options.full_file) {
    console.log(header);
}

diff_file.forEach((card) => {
  console.log(`
    <div class="row">
        <div class="col-sm-12">
        <h2>${card.title}</h2>
        </div>
    </div>
    `);

  const textDiff = diff.main(
    card.previous_text.replaceAll(/<[^>]*>/g, '').replaceAll("\n", "<br />"),
    card.new_text.replaceAll(/<[^>]*>/g, '').replaceAll("\n", "<br />"));
  diff.cleanupSemantic(textDiff);

  // Allow HTML tags for the previous and new blocks to let the formatting show through.
  // Strip them from the diffs to avoid potential challenges where a diff results in invalid
  // HTML tags.
  console.log(`
    <div class="row">
        <div class="col-sm-4">
        <h3>Previous Text</h3>
        <p>${card.previous_text.replaceAll("\n", "<span class=\"break\"></span>")}</p>
        </div>
        <div class="col-sm-4">
        <h3>New Text</h3>
        <p>${card.new_text.replaceAll("\n", "<span class=\"break\"></span>")}</p>
        </div>
        <div class="col-sm-4">
        <h3>Diff</h3>
        <p>${diff.prettyHtml(textDiff).replaceAll("&lt;br /&gt;", "<span class=\"break\"></span>")}</p>
        </div>
    </div>
    `);

//  console.log('<table><thead><th>Original Text</th><th>New Text</th><th>Diff</th>');
//  console.log('<tr>');
//  console.log(`<td>${card.previous_text}</td>`); // produces a formatted HTML string
//  console.log(`<td>${card.new_text}</td>`); // produces a formatted HTML string
//  console.log(`<td>${diff.prettyHtml(textDiff)}</td>`); // produces a formatted HTML string
//  console.log('</tr>');
//  console.log('</table>');
//  console.log('');

});

if (options.full_file) {
    console.log(footer);
}
