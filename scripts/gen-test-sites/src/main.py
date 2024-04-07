"""
Generate every a Jekyll site for every comobonation of test groups
"""

import os
import itertools

def get_working_directory() -> str:
    """
    Return the directory of the website to work on
    """
    # The working directory is the directory three directories up from this file
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

def get_test_groups(directory: str) -> list:
    """
    Returns a list of all possible combinations of test groups (order does not matter)
    """

    # Each test group is represented by a file that starts with _config_test_ and ends with .yml
    test_group_files = [f for f in os.listdir(directory) if f.startswith("_config_test_") and f.endswith(".yml")]

    # Get every unique combination of test groups (order does not matter)
    test_groups = []
    for i in range(1, len(test_group_files) + 1):
        test_groups += list(itertools.combinations(test_group_files, i))

    return test_groups

def gen_test_sites(directory: str, test_groups: list) -> list:
    """
    Generates a Jekyll site for each test group. Renames the build directory to the name
    of the test group.
    Returns a list of all the paths to each site folder.
    """
    site_paths = []

    old_dir = os.getcwd()
    # Change to the working directory
    os.chdir(directory)

    # Delete any existing _site directory
    if os.path.exists("_site"):
        os.system("rm -rf _site")

    for group in test_groups:
        # Group name is the combination of all the test group names without the file extension
        # or _config_test_, and _site appended to the end
        group_name = "_".join([g.split(".")[0].split("_")[-1] for g in group]) + "_site"

        # Call the build script with the test groups
        os.system(f"bundle exec jekyll build --config _config.yml,{','.join(group)}")

        # Rename the build directory to the group name
        os.rename("_site", group_name)

        # Add the path to the site to the list
        site_paths.append(os.path.join(directory, group_name))

    # Change back to the original directory
    os.chdir(old_dir)

    return site_paths

if __name__ == "__main__":
    working_dir = get_working_directory()
    test_groups = get_test_groups(working_dir)
    site_paths = gen_test_sites(working_dir, test_groups)
    print(site_paths)
