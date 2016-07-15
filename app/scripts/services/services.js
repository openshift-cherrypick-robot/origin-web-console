'use strict';

angular.module("openshiftConsole")
  .factory("ServicesService", function($filter, DataService) {
    var DEPENDENCIES = 'service.alpha.openshift.io/dependencies';
    var INFRASTRUCTURE = 'service.openshift.io/infrastructure';
    var annotation = $filter('annotation');

    var getDependenciesJSON = function(service) {
      var dependenciesAnnotation = annotation(service, DEPENDENCIES);
      if (!dependenciesAnnotation) {
        return null;
      }

      try {
        return JSON.parse(dependenciesAnnotation);
      } catch(e) {
        Logger.warn('Could not pase "service.alpha.openshift.io/dependencies" annotation', e);
        return null;
      }
    };

    var getDependentServices = function(service) {
      var serviceNamespace, dependencies = getDependenciesJSON(service);
      if (!dependencies) {
        return [];
      }

      // Find dependent services. Example annotation:
      //   "service.alpha.openshift.io/dependencies": "[{\"name\": \"database\", \"namespace\": \"\", \"kind\": \"Service\"}]"
      // Default kind if missing is Service and default namespace is this namespace.
      serviceNamespace = _.get(service, 'metadata.namespace');
      var isDependentService = function(dependency) {
        if (!dependency.name) {
          return false;
        }

        if (dependency.kind && dependency.kind !== 'Service') {
          return false;
        }

        if (dependency.namespace && dependency.namespace !== serviceNamespace) {
          return false;
        }

        return true;
      };

      return _.chain(dependencies)
              .filter(isDependentService)
              .map(function(dependency) {
                return dependency.name;
              })
              .value();
    };

    var linkService = function(parent, child) {
      var updatedService = angular.copy(parent);
      var dependencies = getDependenciesJSON(updatedService) || [];
      dependencies.push({
        name: child.metadata.name,
        namespace: (parent.metadata.namespace === child.metadata.namespace) ? '' : child.metadata.namespace,
        kind: child.kind
      });

      _.set(updatedService, ['metadata', 'annotations', DEPENDENCIES], JSON.stringify(dependencies));

      return DataService.update("services", updatedService.metadata.name, updatedService, {
        namespace: updatedService.metadata.namespace
      });
    };

    var isInfrastructure = function(service) {
      return annotation(service, INFRASTRUCTURE) === 'true';
    };

    return {
      // Returns an array of service names that are dependencies in the same namespace as service.
      getDependentServices: getDependentServices,
      linkService: linkService,
      isInfrastructure: isInfrastructure
    };
  });