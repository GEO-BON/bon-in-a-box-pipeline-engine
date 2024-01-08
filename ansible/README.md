# Basic setup of the [bon-in-a-box-pipeline-engine](https://github.com/GEO-BON/bon-in-a-box-pipeline-engine) production server

In the following instructions, Ansible is running on your local computer, and installs the BON in a Box server on a remote host over ssh. You will thus need to [install Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html) on your local computer.

0. Make sure ssh is set up properly with the remote server. 
1. On the computer, edit [biab-server.yml](biab-server.yml).
  - The playbook supposes that a data dir is used as a mount point for an external device /dev/vdb on which code and docker files are located. Make sure to edit the playbook to remove or change the mount directive for your server.
  - SSL, pipeline-repo, email, domain, etc.
2. On the computer, edit [hosts](./hosts) to remove placeholders with your server info.
3. On the computer, run `ansible-galaxy install -r requirements.yml`
4. On the computer, run `ansible-playbook -i hosts biab-server.yml`
5. On the server, create a runner.env as per [user instructions](../README-user.md#running-the-servers-locally)
6. On the server, run `./server-up.sh -d`


If your server has a separate data partition for the code, and it does not mount correctly after reboot, you can do the following: 
   - Copy mount_dev-data.sh to the server
   - Edit mount_dev-data.sh to specify the correct device.
   - ssh to the server and run the script whenever necessary.
