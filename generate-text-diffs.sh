#!/bin/sh

# Create a diff of card text between 2 commits in JSON format for use by make-html-text-diffs.ts"

set -e
set -u

OLD_COMMIT=$1
NEW_COMMIT=$2

# Make a temp file for output.
TMP_FILE=$(mktemp)

# Generate a list of file names with diffs between the two commits.
for FILE in $(git diff $OLD_COMMIT $NEW_COMMIT v2/cards/ | grep '^diff --git a/v2/cards' 2>/dev/null | perl -pne 's/.*?cards\/(.*?).json.*$/$1/')
do
  # Emit data if there is a diff ot the "text" field in the card JSON.
  text_diff=$(git diff $OLD_COMMIT $NEW_COMMIT v2/cards/${FILE}.json 2>/dev/null | grep ^'+  "text": ' | wc -l | perl -pne 's/\s+//g')
  if [[ $text_diff == "1" ]]; then
    echo "  {" >> ${TMP_FILE}
    echo "    \"id\": \"$FILE\"," >> ${TMP_FILE}
    grep '"title"' v2/cards/${FILE}.json | perl -pne 's/^/  /' | perl -pne 's/"$/",/' >> ${TMP_FILE}
    git diff $OLD_COMMIT $NEW_COMMIT v2/cards/${FILE}.json 2>/dev/null \
        | grep '"text"' \
        | perl -pne  's/^-  "text": "(.*?)",{0,1}$/    "previous_text": "$1",/' \
        | perl -pne 's/^\+  "text": "(.*?)",{0,1}$/    "new_text": "$1"/' >> ${TMP_FILE}
    echo "  }," >> ${TMP_FILE}
  fi
done

# Strip trailing comma from the final element in the array.
perl -pne 'BEGIN { print "[\n" } END { print "]\n" }' ${TMP_FILE} | perl -0777 -pe 's/},\n\]/}\n]/'

# Clean up temp file.
rm "${TMP_FILE}"