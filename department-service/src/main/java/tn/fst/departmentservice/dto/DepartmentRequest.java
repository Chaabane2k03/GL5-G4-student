package tn.fst.departmentservice.dto;

import tn.fst.departmentservice.entity.Department;

/**
 * Write model for creating and updating a department.
 *
 * <p>Keeping the JPA entity out of the controller signature (Sonar S4684) avoids
 * binding request payloads straight onto a persistent object. The component names
 * match the {@link Department} entity so the existing JSON contract is unchanged.
 * The identifier is owned by the service layer: it is generated on create and taken
 * from the path on update, so it is not part of the request body.
 */
public record DepartmentRequest(
        String name,
        String location,
        String phone,
        String head) {

    public Department toEntity() {
        return new Department(null, name, location, phone, head);
    }
}
