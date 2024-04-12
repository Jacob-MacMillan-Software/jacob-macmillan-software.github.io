---
layout: post
title: A/B Testing a Jekyll Website
categories: guide website
---

# A/B Testing with Jekyll

Websites, like any software product, need to be tested. They need to be tested for both usability and functionality, like any other software, but unlike most other
software, particularly backend software, which is what I primarily work on, websites need to be tested for what users like. At least for now, this type of testing can't be automated.
LLMs may be able to assist you, and it's likely a good start in building your frontend, but you don't really have any way to verify the opinion of LLMs are represented in the
demographic of your website visitors. The only way to know for sure is to try it.

That's where A/B testing comes in. It allows you to run multiple experiments at once, which in combination with your analytics tools allow you to see which your users like more: option A, or option B.

## Setting up the tests

There's a few ways to setup A/B testing for a website. You can do it purely using Javascript, on the client's side, or you can serve completely different files based on the experiment you want to show the user, which is
what this website does. I'll cover both options, but I will focus more on the server side version, as I believe that it's better.

The client-side way may be simpler to implement for most websites, but it does have some drawbacks: namely that the user has the ability to change what test they are seeing. If that isn't something you mind, this may be the better option for you.
Another downside, although not very common, is if the user has Javascript disabled, they won't see any of your tests, and depending on how you configured your tests, the website may be completely missing some content. Keep this in mind when designing your
experiments.

## Using Javascript to enable your tests

### Client Side for Javascript tests 

The Javascript version is pretty simple. In your HTML, all you need to do is put any data you want to hide or show for your experiments in a separate `<div>` and give it a class name to represent your experiment.

```html
<h1> This text is shown to every visitor </h1>
<p> This text is also shown to everyone. </p>

<div class="test-text">
<h2> But only some users will see this one </h2>
</div>
```

And then you'll need some CSS to hide the test when it's not explicitly enabled.

```css
.disable-experiment {
  display: none;
}
```

And then add that class to your test `div`s.

The actual Javascript to enable the test is pretty simple too:

```js
const body = document.getElementByTagName('body')[0];
const experiments = body.getAttribute("data-experiments").split(' ');

for ( const class of experiments ) {
  const elements = document.getElementsByClassName(class);
  for ( const ele of elements ) {
    ele.classList.remove('disable-experiment');
  }
}
```

This is pretty simple. It just loops through an attribute on the `body` tag of the page called `data-experiments`, which we will
inject from a server that we will write later. The `data-experiments` attribute will contain a space-separated list of experiments.
The names will match the class name assigned to the experiment `div`(s). We then remove the `disable-experiment` class from each of
the enabled experiments, which will make them visible to the visitor.


### Server Side for Javascript tests

For the server we'll use a Cloudflare Worker. If you would rather use Express.js or an AWS Lambda function, it will be basically
the same. You could even write a server from scratch and host it yourself, if you prefer.

Helpfully, Cloudflare provides a Worker template for this exact use-case. If you have a Cloudflare account, you can login and
head over to the "Workers & Pages" tab, and select "Create application". From there you should see the "A/B test script" template,
which should look something like this:

```js
const ORIGIN_URL = 'https://example.com';
const EXPERIMENTS = [
  { name: 'big-button', threshold: 0.5 }, // enable the Big Button experiment for 50% of users
  { name: 'new-brand', threshold: 0.1 }, // enable the New Brand experiment for 10% of users
  { name: 'new-layout', threshold: 0.02 }, // enable the New Layout experiment for 2% of users
];


export default {
  async fetch(request, env, ctx) {
    const fingerprint = [request.headers.get('cf-connecting-ip'), request.cf?.postalCode]; // add any values you want considered as a fingerprint
    const activeExperiments = await getActiveExperiments(fingerprint, EXPERIMENTS);


    // add a data-experiments attribute to the <body> tag
    // which can be styled in CSS with a wildcard selector like [data-experiments*="big-button"]
    const rewriter = new HTMLRewriter().on('body', {
      element(element) {
        element.setAttribute('data-experiments', activeExperiments.join(' '));
      },
    });


    const res = await fetch(ORIGIN_URL, request);


    return rewriter.transform(res);
  },
};


// Get active experiments by hashing a fingerprint
async function getActiveExperiments(fingerprint, experiments) {
  const fingerprintHash = await hash('SHA-1', JSON.stringify(fingerprint));
  const MAX_UINT8 = 255;
  const activeExperiments = experiments.filter((exp, i) => fingerprintHash[i] <= exp.threshold * MAX_UINT8);
  return activeExperiments.map((exp) => exp.name);
}


// Hash a string using the Web Crypto API
async function hash(algorithm, message) {
  const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest(algorithm, msgUint8); // hash the message
  const hashArray = new Uint8Array(hashBuffer); // convert buffer to byte array
  return hashArray;
}
```

The only changes you'll need to make is at the top of the file. The `ORIGIN_URL` needs to point to where all your website files are
hosted, and they must be publicly accessible from here. `EXPERIMENTS` is simply a list of all the experiments you want to run.

After you make your changes, you'll just publish your worker, and setup your domain name to point to the worker instead of your website.
Instead of using `ORIGIN_URL` and pulling the files from a different URL, you can set it up to pull the files from an R2 or S3 bucket
instead, which we'll cover in the [Server Side for server side tests](#server-side-for-server-side-tests) section. 

## Using the server to handle tests

### HTML changes for server side tests

If you'd rather manage your tests in a way more hidden from users, this is probably the best option for you. Since our website
is written in Jekyll (or just using the Liquid template engine), it is pretty simple to setup your tests.

Simply wrap any code that you only want enabled for tests in an `if` block. For example, this website has the following code for
the header bar:

```html
<div class="trigger">
    {%- for path in page_paths -%}
        {%- assign my_page = site.pages | where: "path", path | first -%}
            {%- if my_page.title -%}
                {%- if site.portfolio == true and my_page.title == "About" -%}
                    <a class="page-link" href="{{ my_page.url | relative_url }}">Portfolio</a>
                {%- else -%}
                    <a class="page-link" href="{{ my_page.url | relative_url }}">{{ my_page.title | escape }}</a>
                {%- endif -%}
        {%- endif -%}
    {%- endfor -%}
</div>
```

The important line here is: `{%- if site.portfolio == true and my_page.title == "About" -%}`. We have a variable called
`portfolio` that we set in the site's config file. That is what tells Jekyll that the test has been enabled, and when it is
we'll call the `About` page `Portfolio`. If you look at the header right now, and see `Portfolio` that means that that
variable has been set in the version of the site that you're seeing.

Very helpfully, Jekyll lets us pass in multiple config files when we build our site. Any variable in a file later in the
list will override the setting in previous files.

So, let's make a config file for our new test. We'll name it `_config_test_portfolio.yml`. It's only one line:

```yaml
protfolio: true
```

And then if we want to enable the test we can build the site with the following command:

```bash
bundle exec jekyll build -c _config.yml,_config_test_portfolio.yml
```

### Server Side for server side tests

The server for this is very similar to the Javascript version. We'll start with the template that we used last time, for the Clouldflare
Worker:

```js
const ORIGIN_URL = 'https://example.com';
const EXPERIMENTS = [
  { name: 'big-button', threshold: 0.5 }, // enable the Big Button experiment for 50% of users
  { name: 'new-brand', threshold: 0.1 }, // enable the New Brand experiment for 10% of users
  { name: 'new-layout', threshold: 0.02 }, // enable the New Layout experiment for 2% of users
];


export default {
  async fetch(request, env, ctx) {
    const fingerprint = [request.headers.get('cf-connecting-ip'), request.cf?.postalCode]; // add any values you want considered as a fingerprint
    const activeExperiments = await getActiveExperiments(fingerprint, EXPERIMENTS);


    // add a data-experiments attribute to the <body> tag
    // which can be styled in CSS with a wildcard selector like [data-experiments*="big-button"]
    const rewriter = new HTMLRewriter().on('body', {
      element(element) {
        element.setAttribute('data-experiments', activeExperiments.join(' '));
      },
    });


    const res = await fetch(ORIGIN_URL, request);


    return rewriter.transform(res);
  },
};


// Get active experiments by hashing a fingerprint
async function getActiveExperiments(fingerprint, experiments) {
  const fingerprintHash = await hash('SHA-1', JSON.stringify(fingerprint));
  const MAX_UINT8 = 255;
  const activeExperiments = experiments.filter((exp, i) => fingerprintHash[i] <= exp.threshold * MAX_UINT8);
  return activeExperiments.map((exp) => exp.name);
}


// Hash a string using the Web Crypto API
async function hash(algorithm, message) {
  const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest(algorithm, msgUint8); // hash the message
  const hashArray = new Uint8Array(hashBuffer); // convert buffer to byte array
  return hashArray;
}
```

We are going to serve the website files from an R2 bucket, so we can replace `ORIGIN_URL` with our bucket in the `env` parameter.
We also don't mind having all our experiments being equally likely to be chosen, so instead of the `EXPERIMENTS` array we'll
find out what experiments we have by just looking at the top level directories in our R2 bucket. This way we won't need to update
the Worker every time we want to add or remove an experiment.

Since we have no `EXPERIMENTS` array, we'll also completely rewrite the `getActiveExperiments` function. We'll change the name too. We'll
call it `selectExperiment`.

So, first we'll change our `fetch` function.

```js
async fetch(request, env, ctx) {
  // Get the page that the caller has requested
  const path = new URL(request.url).pathname;

  const fingerprint = [ request.headers.get('cf-connecting-ip'), request.cf?.postalCode ];

  // Get all top level directories in the bucket. These are all the possible test sites
  const allFiles = await env.SITE_BUCKET.list();

  // Filter to only top level directories
  const activeExperiments = [];
  for (const file of allFiles.objects) {
    const parts = file.key.split('/');
    if (parts.length === 2 && !activeExperiments.includes(parts[0])) {
      activeExperiments.push(parts[0]);
    }
  }

  // Select an experiment based on the fingerprint
  const experiment = await selectExperiment(fingerprint, activeExperiments);

  // Serve the file
  let fileKey = path;
  if (fileKey.split('.')[1] == null) {
    fileKey = `${experiment}${fileKey}index.html`
  } else {
    fileKey = `${experiment}${fileKey}`
  }
  
  const file = await env.SITE_BUCKET.get(fileKey);
  return new Response(file.body)
}
```

We first get the path the user requested. We use this so we know what file to send them later. Next we get their fingerprint, which
is the same as the template.

After that we get a list of every file in the R2 bucket, and then filter that down to only the top level directories. This is a list
of all our available experiments. It's important that we only use this bucket for our website experiments, as any other folder in this
bucket will be treated as an experiment.

After we have the list of all experiments, we call `selectExperiment` to pick which folder to pull the file from, and then we
return the file from the selected folder.

Our `selectExperiment` function works similarly to the `getActiveExperiments` function from the template:

```js
async function selectExperiment(fingerprint, activeExperiments) {
  const fingerprintHash = await hash('SHA-1', JSON.stringify(fingerprint));
  const fingerprintHashString = fingerprintHash.join('');

  const experimentIndex = parseInt(fingerprintHashString, 16) % activeExperiments.length;
  return activeExperiments[experimentIndex];
}
```

Our `hash` function remains unchanged.

This is a trimmed down version of what this website uses. The only major difference is that this website's Worker handles
invalid page requests by returning a 404 page. You can see the Worker that this site uses [here](https://github.com/Jacob-MacMillan-Software/jacob-macmillan-software.github.io/blob/e970d353f97373aa332d6fb6348e31e6d91396b2/scripts/test-selector/src/index.ts){:target:"_blank"}.

The `SITE_BUCKET` is configured in our `wrangler.toml` file:
```toml
[[r2_buckets]]
binding = 'SITE_BUCKET'
bucket_name = '<bucket name>'
```

And then we can deploy the function with wrangler, as normal with `npx wrangler deploy`.

Now you can open your web browser, navigate to the URL of your newly deployed worker, and you should see an error page because you forgot to upload your website to the R2 bucket.

You can do this manually with `npx wrangler r2 object put <path in bucket> --file <file>`, or you can upload them through the web interface, or you can write a script to do it automatically, which is what we're going to do in the next section.

# (Optional) Extra Utility Scripts

## Uploading to R2 Bucket

Before we get started on the script, we need to get all our different experiment website builds together. We'll put them in a folder called `_test_sites`.

Let's build all two versions of our site. One with the "portfolio" test enabled, and one without.

```bash
mkdir _test_site

bundle exec jekyll build -d _test_sites/default_site
bundle exec jekyll build -c _config.yml,_config_test_portfolio.yml -d _test_sites/portfolio_site
```

And we'll put our script to upload the files in `scripts/copy-to-bucket`.

We'll write the script in bash, so we can simply use the wrangler CLI to interact with the R2 bucket. Technically this can be done in any language, of course, but our script isn't very complex, so bash will do just fine.

The script will be pretty simple. It only really needs to do two tasks:
1. delete the old website builds that are in the bucket (if there are any)
2. upload the new website builds to the bucket

First we'll delete all the old files. There's two ways we can do this. We can delete the entire bucket and recreate it, or we can just delete the files. Deleting the bucket is simpler. It's just

```bash
npx wrangler r2 bucket delete <bucket name>
npx wrangler r2 bucket create <bucket name>
```

But that feels dirty to me for some reason, so I opted to instead delete every file.

If we look at the help menu for `wrangler r2 object --help`, you'll see we have to delete each object individually, so we'll need to get a list of all the objects.

```bash
npx wrangler r2 object get <bucket name>/
```

First, you'll see that I added a `/` to the bucket name. This is important. If you don't add that `/` wrangler will just throw an error and exit. Second, if you look at the end of the output you'll notice that it's truncated, and only shows 20 results per page. This is fine. We'll
just have to use a loop.

We'll get a list of the first 20 objects, delete them, and then get a list of the next 20, and repeat until we don't have any objects left:

```bash
BUCKET_NAME=$1

while
    # Get array of the files
    BUCKET_OBJECTS=$( npx wrangler r2 object get ${BUCKET_NAME}/ 2> /dev/null | sed -n '/{/,$p}' -- | jq '.result[]' -c )
    [[ "$BUCKET_OBJECTS" == "" ]] && break

    for obj in $BUCKET_OBJECTS; do
        npx wrangler r2 object delete ${BUCKET_NAME}/$( echo $obj | jq .key | tr -d '"' )
    done
do true ; done
```

This might be kind of confusing if you're not familiar with bash, so I'll explain the line where `BUCKET_OBJECTS` gets assigned. The `$()` wrapping means "run this as a command". We already know what the wrangler command does. The next thing after is `2>` which tells bash to print
anything printed to `stderr` to the file following the `2>` symbol instead of to `stdout`. `/dev/null` is a file that you can think of as a void. Anything printed there is discarded, never to be seen again. This means that any error messages from wrangler will be discarded.
This is important because error messages may cause the next parts to produce errors.

The `|` (pipe) symbol is very important in bash. It means to send the output of one command to whatever command comes after the pipe character. In this case that is a `sed` command. This particular `sed` command will output the first line we find that starts with the `{` character.
This is the start of the JSON output. We pass that to a program called `jq`, which we'll use to parse the JSON. the `.result[]` means that we only want the array found in the JSON string with the key "result". If you add `echo $BUCKET_OBJECTS` you can see exactly what the final
output looks like.

After that we check if `BUCKET_OBJECTS` is empty, and if it is we break out of the loop. If not, we use a `for` loop to loop through each object and delete it from the bucket.

Now that we've cleaned out our bucket, we can upload the new sites to it. We know where our website files are, relative to our script, so let's set a variable to point to it our script, and from there we know how to navigate to our websites.

```bash
SCRIPT_PATH="$( cd -- "$(dirname "$0")" > /dev/null 2>&1; pwd -P )"
WEBSITE_PATH="$SCRIPT_PATH/../../_test_sites"
```

The slightly complicated command to get `SCRIPT_PATH` is simply because the script can be called from any directory in the system, so we have to account for the fact that the caller will possibly not be in the same folder as the script.

Now we can loop through all the sites we've built.

```bash
for website in "$WEBSITE_PATH"/*; do
    WEBSITE_NAME=${website##*/}
    echo $WEBSITE_NAME
done
```

This will print out the name of each of our website folders. To upload the files we'll have to upload each file in each subdirectory of the website. It's probably easiest to do this recursively, so that's what we'll do. We'll start in the website's root folder,
and loop through everything in that folder. If it's a file we upload it, if it's a folder we enter that and loop through every file in that folder, and repeat until we stop finding folders.

```bash
function upload_site () {
    # Function paramteres in bash are weird. They're $1, $2, $3, etc. (same as command line arguments outside of the functions)
    LOCAL_WEBSITE_PATH=$1
    WEBSITE_NAME=$2

    # Upload each file
    for file in "$LOCAL_WEBSITE_PATH"/*; do
        # If $file is a regular file
        if [[ -f "$file" ]]; then
            # Remove "$WEBSITE_PATH" from the filename
            CLEANED_FILENAME=${file#$WEBSITE_PATH}
            
            # Upload file
            npx wranger r2 object put ${BUCKET_NAME}/${CLEANED_FILENAME} --file $file
        elif [[ -d "$file" ]]; then # If $file is a directory
            upload_site $file $WEBSITE_NAME
        fi
    done
}
```

and we'll update our `for` loop to call this function

```bash
for website in "$WEBSITE_PATH"/*; do
    WEBSITE_NAME=${website##*/}
    upload_site $website $WEBSITE_NAME
done
```

The full script is available [here](https://github.com/Jacob-MacMillan-Software/jacob-macmillan-software.github.io/blob/25661ba043f190225d446929af14183aedcba888/scripts/copy-to-bucket/copy-to-bucket.sh){:target="_blank"}.

## Automatically building the websites

This website also utilizes a Python script to automatically build each and every combinations of experiments.

If there are some experiments that are mutually exclusive, you can simply disable the other one in the config file for
the one you want. Since the config files are read in order, and later ones override the previous ones, this will result in only the last test in the list being used. Or, you can do what I did and have every test work
correctly with every other test. Regardless, let's start writing our build script.

So, what exactly does the script need to do? It needs to navigate to the folder where all our website source is located (or at least know where to find the files), remove the previous website builds, get a list of every experiment we have,
and then run `bundle exec jekyll build -c <configs>` for every possible combination of config files.

We'll put our script in the folder `scripts/gen-test-sites/src`, so we can get the path to the website source with the following function:

```python
def get_working_directory() -> str:
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
```

This returns the path to the folder three folders up from the script that we're running. This works regardless of how you call the script.

The next step is to write a function to generate all the possible experiment groups. For this website, order doesn't matter, but if you have different behaviour depending on the order (ie. mutually exclusive experiments), you'll have to modify this function slightly.
To get every test group, we simply search the website directory for every YAML file starting with `_config_test_`. Then we can simply use `itertools.combinations` to construct our experiment groups.

```python
def get_test_groups(directory: str) -> list:
    # Get a list of each experiment
    test_group_files = [f for f in os.listdir(directory) if f.startswith("_config_test_") and f.endswith(".yml")]

    # Get every unique combination of tests (order doesn't matter)
    test_groups = []
    for i in range(1, len(test_group_files) + 1):
        test_groups += list(itertools.combinations(test_group_files, i))

    # Add an empty test group to build the base site
    test_groups.append(())

    return test_groups
```

And now all that's left to do is build the sites. We can do this by simply calling `bundle exec jekyll build` as we would on the command line, through `os.system`. We need a bit of setup before that though. We need to cleanup old sites, and
make sure we have a folder to put the new ones, which we'll call `_test_sites` to match our upload script.

```python
def gen_test_sites(directory: str, test_groups: list) -> list:
    site_paths = []

    old_dir = os.getcwd()
    
    # Move to the same folder as the website
    os.chdir(directory)

    # Cleanup
    # Create _test_sites folder if it doesn't exist. Otherwise delete and remake
    if not os.path.exists("_test_sites"):
        os.mkdir("_test_sites")
    else:
        os.system("rm -rf _test_sites")
        os.mkdir("_test_sites")

    # Loop through each group and build
    for group in test_groups:
        # Group name is a combination of all the test group names without the file extensions
        # and without _config_test_, and with _site appended to the end
        group_name = "_".join([g.split(".")[0].slpit("_")[-1] for g in group])

        # Call the jekyll build function
        os.system(f"bundle exec jekyll build --config _config.yml,{','.join(group)}")

        # Rename build directory to group_name
        os.rename("_site", group_name)

        # Move to desired folder
        os.system(f"mv {group_name} _test_sites")

        # Add path to the site to the list
        site_path.append(os.path.join(directory + "/_test_sites", group_name))

    # Change back to the original directory
    ow.chdir(old_dir)

    return site_paths
```

And there you have it. A rather simple script, that should save you a lot of time manually typing out build commands. The only thing left to do is call all those functions.

```python
if __name__ == "__main__":
    working_dir = get_working_directory()
    test_groups = get_test_groups(working_dir)
    site_paths = gen_test_sites(working_dir, test_groups)

    # Make site paths a valid JSON string
    site_paths = str(site_paths).replace("'", '"')
    print(site_paths)
```

The full script is available [here](https://github.com/Jacob-MacMillan-Software/jacob-macmillan-software.github.io/blob/25661ba043f190225d446929af14183aedcba888/scripts/gen-test-sites/src/main.py){:target="_blank"}.

If you have any questions or comments, please feel free to email me at [me@jacobmacmillan.xyz](mailto:me@jacobmacmillan.xyz){:target="_blank"}.
