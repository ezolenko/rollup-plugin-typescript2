## Troubleshooting
<!--
  Please follow the steps below to ensure that you have troubleshot this problem sufficiently to believe that it is a bug in this plugin.
  Many issues are the result of common misconfigurations and are not bugs, so please follow the steps to help us help you and prioritize limited volunteer maintainer time.
-->

1. Does `tsc` have the same output? If so, please explain why this is incorrect behavior
    <!--
      This plugin uses the TS LanguageService under-the-hood.
      It tries to mimic tsc and add Rollup semantics where possible, so if tsc has the same output, the error you're getting may be correct and accurate.
      There are cases where they should differ, however, so if this is one of those, please elaborate.
    -->

1. Does your Rollup plugin order match [this plugin's compatibility](https://github.com/ezolenko/rollup-plugin-typescript2#compatibility)? If not, please elaborate
    <!--
      Rollup plugin order matters, so if there is a mismatch here, that could be the cause of your issue.
    -->

1. Can you create a [minimal example](https://stackoverflow.com/help/minimal-reproducible-example) that reproduces this behavior?
    <!--
      Minimal reproductions help us find the root cause of an issue much more expediently than trying to interpret and disentangle a complicated repo.
      The process of creating a minimal reproduction also often helps users find a misconfiguration in their code.
      It could also help you identify the root cause yourself and potentially create a Pull Request to fix it!
    -->

## What happens and why it is incorrect
<!--
  Please explain the issue you are encountering and why you believe it is incorrect behavior, in detail.
  Please list any error messages here.
-->

## Environment
<!-- Please describe your environment, especially anything potentially relevant to the problem -->

### Versions
<!--
  PLEASE RUN THIS COMMAND INSIDE YOUR PROJECT:

  npx envinfo --npmPackages typescript,rollup,rollup-plugin-typescript2

  AND PASTE ITS CONTENTS BELOW INSIDE THE CODE SNIPPET vvvvvvvvv
-->

```text

```

<!--- paste your rollup config below if relevant --->
<details>
  <summary><h4><code>rollup.config.js</code></h4>: </summary>

<!--- INSERT rollup.config.ts IN THE CODE SNIPPET BELOW --->

```js

```

</details>

<!--- paste your tsconfig.json below if relevant --->
<details>
  <summary><h4><code>tsconfig.json</code></h4>: </summary>

<!--- INSERT tsconfig.json IN THE CODE SNIPPET BELOW --->

```json5

```

</details>

<!--- paste your package.json below if relevant --->
<details>
  <summary><h4><code>package.json</code></h4>: </summary>

<!--- INSERT package.json IN THE CODE SNIPPET BELOW --->

```json

```

</details>

<!--- add verbosity verbosity: 3 to plugin options and attach output if relevant (censor out anything sensitive) --->
<details>
  <summary><h4>plugin output with verbosity 3</h4>: </summary>

<!--- INSERT plugin output IN THE CODE SNIPPET BELOW or attach --->

```text

```

</details>
