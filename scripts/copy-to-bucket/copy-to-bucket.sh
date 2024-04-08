#!/usr/bin/env bash

SCRIPT_PATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1; pwd -P )"
WEBSITE_PATH="$SCRIPT_PATH/../.."
BUCKET_NAME=$1

REAL_WD=$( pwd -P )

function upload_site () {
	LOCAL_WEBSITE_PATH=$1
	WEBSITE_NAME=$2

	echo Searching $LOCAL_WEBSITE_PATH

	# Upload each file in the folder, and then repeat for each subdirectory
	for file in "$LOCAL_WEBSITE_PATH"/*; do
		if [[ -f "$file" ]]; then
			CLEANED_FILENAME=${file#$WEBSITE_PATH/_test_sites/}
			npx wrangler r2 object put ${BUCKET_NAME}/${CLEANED_FILENAME} --file $file
		elif [[ -d "$file" ]]; then
			#echo $file is dir
			upload_site $file $WEBSITE_NAME
		fi
	done
}

cd $SCRIPT_PATH

# We need to do a loop through because the get command doesn't get everything at once
while
	# Get array of all files in bucket
	BUCKET_OBJECTS=$( npx wrangler r2 object get ${BUCKET_NAME}/ 2> /dev/null | sed -n '/{/,$p' -- | jq '.result[]' -c )
	[[ "$BUCKET_OBJECTS" == "" ]] && break

	for obj in $BUCKET_OBJECTS; do
		npx wrangler r2 object delete ${BUCKET_NAME}/$( echo $obj | jq .key | tr -d '"' )
	done
do true ; done

# Upload all sites in $WEBSITE_PATH/_test_sites/
#cd $WEBSITE_PATH/_test_sites
for website in "$WEBSITE_PATH"/_test_sites/*; do
	WEBSITE_NAME=${website##*/}
	echo $WEBSITE_NAME
	if [[ -d "$website" ]]; then
		upload_site $website $WEBSITE_NAME
	fi
done
